import type { CollectionAfterChangeHook } from 'payload'
import type { DrugTest } from '@/payload-types'
import { getRecipients } from '../email/recipients'
import { buildCollectedEmail, buildScreenedEmail, buildCompleteEmail } from '../email/templates'
import { promises as fsPromises } from 'fs'
import path from 'path'

const TEST_MODE = process.env.EMAIL_TEST_MODE === 'true'
const TEST_EMAIL = 'mike@midrugtest.com'

/**
 * AfterChange Hook: Send email notifications based on workflow stage transitions
 *
 * Runs AFTER computeTestResults and AFTER data is saved to database
 *
 * Email Triggers:
 * - Lab tests: collected → Send "sample collected" notification
 * - All tests: screened → Send "results available" notification
 * - All tests: complete → Send "final results" notification
 *
 * Test Mode:
 * Set EMAIL_TEST_MODE=true in .env to send all emails to mike@midrugtest.com
 *
 * Skip Option:
 * Uncheck "Send Notifications" field before saving to skip sending emails
 */
export const sendNotificationEmails: CollectionAfterChangeHook<DrugTest> = async ({
  doc,
  req,
  context,
}) => {
  // Skip if we're just updating notification history (prevent infinite loop)
  if (context?.skipNotificationHook) {
    return doc
  }

  // Check if sendNotifications checkbox is checked
  if (doc.sendNotifications === false) {
    req.payload.logger.info(`Email notifications skipped for drug test ${doc.id} (checkbox unchecked)`)
    return doc
  }

  const { payload } = req

  try {
    // Check which stages have already been sent
    const sentStages = new Set(
      (doc.notificationsSent || []).map((n: any) => n.stage)
    )

    // Determine which email stage to send based on current state
    let emailStage: 'collected' | 'screened' | 'complete' | null = null

    const isLabTest =
      doc.testType === '11-panel-lab' ||
      doc.testType === '17-panel-sos-lab' ||
      doc.testType === 'etg-lab'

    // Check if confirmation testing was done
    const hadConfirmation = doc.confirmationDecision === 'request-confirmation'
    const confirmationSubstances = doc.confirmationSubstances || []
    const confirmationResults = doc.confirmationResults || []
    const confirmationComplete =
      hadConfirmation &&
      confirmationResults.length > 0 &&
      confirmationResults.length === confirmationSubstances.length

    // Stage 1: For lab tests in collected state (sample sent to lab)
    if (isLabTest && doc.screeningStatus === 'collected' && !sentStages.has('collected')) {
      emailStage = 'collected'
    }
    // Stage 2: Screening is done (results entered) - send regardless of isComplete
    else if (doc.screeningStatus === 'screened' && doc.initialScreenResult && !sentStages.has('screened')) {
      emailStage = 'screened'
    }
    // Stage 3: Confirmation complete (ONLY if confirmation was actually done)
    else if (confirmationComplete && !sentStages.has('complete')) {
      emailStage = 'complete'
    }

    // No email needed at this stage
    if (!emailStage) {
      return doc
    }

    // For screened and complete stages, require appropriate document before sending ANY emails
    if (emailStage === 'screened') {
      const testDocumentId = typeof doc.testDocument === 'string' ? doc.testDocument : doc.testDocument?.id

      if (!testDocumentId) {
        payload.logger.warn(
          `Email notifications pending for drug test ${doc.id}: Upload screening test document to send results emails`,
        )
        return doc
      }
    } else if (emailStage === 'complete') {
      // For complete stage, need either confirmation document OR test document
      const confirmationDocId =
        typeof doc.confirmationDocument === 'string'
          ? doc.confirmationDocument
          : doc.confirmationDocument?.id
      const testDocId = typeof doc.testDocument === 'string' ? doc.testDocument : doc.testDocument?.id

      if (!confirmationDocId && !testDocId) {
        payload.logger.warn(
          `Email notifications pending for drug test ${doc.id}: Upload confirmation document (or test document) to send final emails`,
        )
        return doc
      }
    }

    // Fetch client and recipients
    const clientId = typeof doc.relatedClient === 'string' ? doc.relatedClient : doc.relatedClient.id
    const client = await payload.findByID({
      collection: 'clients',
      id: clientId,
      depth: 0,
    })

    if (!client) {
      payload.logger.warn(`Client not found for drug test ${doc.id}`)
      return doc
    }

    const { clientEmail, referralEmails } = await getRecipients(clientId, payload)

    // Warn if no referrals found (but continue with client email)
    if (referralEmails.length === 0) {
      payload.logger.warn(
        `No referral recipients found for drug test ${doc.id} - client type: ${client.clientType}`,
      )
    }

    // Build email content based on stage
    const clientName = `${client.firstName} ${client.lastName}`
    let clientEmailData: { subject: string; html: string } | null = null
    let referralEmailData: { subject: string; html: string } | null = null

    if (emailStage === 'collected') {
      // Only referrals get "collected" emails - clients don't need notification yet
      const emailData = buildCollectedEmail({
        clientName,
        collectionDate: doc.collectionDate!,
        testType: doc.testType,
      })
      referralEmailData = emailData
    } else if (emailStage === 'screened') {
      const emails = buildScreenedEmail({
        clientName,
        collectionDate: doc.collectionDate!,
        testType: doc.testType,
        initialScreenResult: doc.initialScreenResult!,
        detectedSubstances: (doc.detectedSubstances as string[]) || [],
        expectedPositives: (doc.expectedPositives as string[]) || [],
        unexpectedPositives: (doc.unexpectedPositives as string[]) || [],
        unexpectedNegatives: (doc.unexpectedNegatives as string[]) || [],
        isDilute: doc.isDilute || false,
      })
      clientEmailData = emails.client
      referralEmailData = emails.referrals
    } else if (emailStage === 'complete') {
      const emails = buildCompleteEmail({
        clientName,
        collectionDate: doc.collectionDate!,
        testType: doc.testType,
        initialScreenResult: doc.initialScreenResult!,
        detectedSubstances: (doc.detectedSubstances as string[]) || [],
        expectedPositives: (doc.expectedPositives as string[]) || [],
        unexpectedPositives: (doc.unexpectedPositives as string[]) || [],
        unexpectedNegatives: (doc.unexpectedNegatives as string[]) || [],
        isDilute: doc.isDilute || false,
        confirmationResults: doc.confirmationResults as any,
        finalStatus: doc.finalStatus || doc.initialScreenResult!, // Use finalStatus if available
      })
      clientEmailData = emails.client
      referralEmailData = emails.referrals
    }

    // Send emails and track recipients
    const sentTo: string[] = []

    // For "collected" stage, send simple notification to referrals only (no results yet)
    if (emailStage === 'collected') {
      if (referralEmailData && referralEmails.length > 0) {
        const recipients = TEST_MODE ? [TEST_EMAIL] : referralEmails

        for (const email of recipients) {
          await payload.sendEmail({
            to: email,
            from: payload.email.defaultFromAddress,
            subject: TEST_MODE
              ? `[TEST MODE] ${referralEmailData.subject}`
              : referralEmailData.subject,
            html: referralEmailData.html,
          })
          sentTo.push(`Referral: ${email}${TEST_MODE ? ' (TEST MODE)' : ''}`)
        }
      }
    } else {
      // For screened/complete stages, attach appropriate document to both client and referral emails
      // For "screened" stage: use testDocument (initial screening results)
      // For "complete" stage: use confirmationDocument if exists, otherwise testDocument
      let documentId: string | null | undefined = null

      if (emailStage === 'screened') {
        documentId = typeof doc.testDocument === 'string' ? doc.testDocument : doc.testDocument?.id
      } else if (emailStage === 'complete') {
        // Prefer confirmation document if it exists (includes both initial and confirmation results)
        const confirmationDocId =
          typeof doc.confirmationDocument === 'string'
            ? doc.confirmationDocument
            : doc.confirmationDocument?.id
        const testDocId = typeof doc.testDocument === 'string' ? doc.testDocument : doc.testDocument?.id

        documentId = confirmationDocId || testDocId
      }

      if (!documentId) {
        payload.logger.warn(
          `No document attached for drug test ${doc.id} (stage: ${emailStage}) - skipping all emails`,
        )
      } else {
        // Fetch the document using local API with overrideAccess
        const testDocument = await payload.findByID({
          collection: 'private-media',
          id: documentId,
          overrideAccess: true,
        })

        if (!testDocument || !testDocument.filename) {
          payload.logger.warn(
            `Document ${documentId} not found or has no filename - skipping all emails`,
          )
        } else {
          // Since disableLocalStorage: false, files are stored in staticDir
          const localPath = path.join(process.cwd(), 'private-media', testDocument.filename)

          try {
            // Check if file exists (async)
            await fsPromises.access(localPath)

            // Read file (async)
            const fileBuffer = await fsPromises.readFile(localPath)
            payload.logger.info(`Attaching test document: ${testDocument.filename}`)

            // Send to client with attachment
            if (clientEmailData && clientEmail) {
              const toAddress = TEST_MODE ? TEST_EMAIL : clientEmail
              await payload.sendEmail({
                to: toAddress,
                from: payload.email.defaultFromAddress,
                subject: TEST_MODE
                  ? `[TEST MODE] ${clientEmailData.subject}`
                  : clientEmailData.subject,
                html: clientEmailData.html,
                attachments: [
                  {
                    filename: testDocument.filename || 'drug-test-report.pdf',
                    content: fileBuffer,
                    contentType: testDocument.mimeType || 'application/pdf',
                  },
                ],
              })
              sentTo.push(`Client: ${toAddress}${TEST_MODE ? ' (TEST MODE)' : ''}`)
            }

            // Send to referrals with attachment
            if (referralEmailData && referralEmails.length > 0) {
              const recipients = TEST_MODE ? [TEST_EMAIL] : referralEmails

              for (const email of recipients) {
                await payload.sendEmail({
                  to: email,
                  from: payload.email.defaultFromAddress,
                  subject: TEST_MODE
                    ? `[TEST MODE] ${referralEmailData.subject}`
                    : referralEmailData.subject,
                  html: referralEmailData.html,
                  attachments: [
                    {
                      filename: testDocument.filename || 'drug-test-report.pdf',
                      content: fileBuffer,
                      contentType: testDocument.mimeType || 'application/pdf',
                    },
                  ],
                })
                sentTo.push(`Referral: ${email}${TEST_MODE ? ' (TEST MODE)' : ''}`)
              }
            }
          } catch (fileError) {
            payload.logger.warn(
              `Test document file not found or unreadable at ${localPath} - skipping all emails`,
            )
          }
        }
      }
    }

    // Update notification history (without triggering hooks again)
    const updatedNotifications = [
      ...(doc.notificationsSent || []),
      {
        stage: emailStage,
        sentAt: new Date().toISOString(),
        recipients: sentTo.join(', '),
      },
    ]

    await payload.update({
      collection: 'drug-tests',
      id: doc.id,
      data: {
        notificationsSent: updatedNotifications,
      },
      context: {
        skipNotificationHook: true, // Prevent infinite loop
      },
    })

    payload.logger.info(
      `Email notifications sent for drug test ${doc.id} (${emailStage}): ${sentTo.join(', ')}`,
    )
  } catch (error) {
    // Log error but don't fail the save
    payload.logger.error(`Failed to send email notifications for drug test ${doc.id}:`, error)
  }

  return doc
}
