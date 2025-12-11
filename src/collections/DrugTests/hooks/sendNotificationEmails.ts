import type { CollectionAfterChangeHook } from 'payload'
import type { DrugTest } from '@/payload-types'
import { getRecipients } from '../email/recipients'
import {
  buildCollectedEmail,
  buildScreenedEmail,
  buildCompleteEmail,
  buildInconclusiveEmail,
} from '../email/templates'
import { createAdminAlert } from '@/lib/admin-alerts'
import { fetchClientHeadshot } from '../email/fetch-headshot'
import { fetchDocument, sendEmails } from '../services'

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
 * Implementation:
 * - Uses fetchDocument() service to retrieve PDF attachments from S3/local storage
 * - Uses sendEmails() service to send emails with TEST_MODE support and admin alerts
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
    req.payload.logger.info(
      `Email notifications skipped for drug test ${doc.id} (checkbox unchecked)`,
    )
    return doc
  }

  const { payload } = req

  try {
    // Check which stages have already been sent
    const sentStages = new Set((doc.notificationsSent || []).map((n: any) => n.stage))

    // Log existing notification history for debugging
    if (doc.notificationsSent && doc.notificationsSent.length > 0) {
      payload.logger.info(
        `Drug test ${doc.id} has existing notifications for stages: ${Array.from(sentStages).join(', ')}`,
      )
    }

    // Determine which email stage to send based on current state
    let emailStage: 'collected' | 'screened' | 'complete' | 'inconclusive' | null = null

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

    // Stage: Inconclusive (sample invalid - cannot be screened)
    if (doc.isInconclusive) {
      if (sentStages.has('inconclusive')) {
        payload.logger.info(
          `Drug test ${doc.id} is marked inconclusive but notification already sent - skipping`,
        )
      } else {
        payload.logger.info(
          `Drug test ${doc.id} is marked inconclusive and no notification sent yet - will send`,
        )
        emailStage = 'inconclusive'
      }
    }
    // Stage 1: For lab tests in collected state (sample sent to lab)
    else if (isLabTest && doc.screeningStatus === 'collected' && !sentStages.has('collected')) {
      emailStage = 'collected'
    }
    // Stage 2: Screening is done (results entered) - send regardless of isComplete
    else if (
      doc.screeningStatus === 'screened' &&
      doc.initialScreenResult &&
      !sentStages.has('screened')
    ) {
      emailStage = 'screened'
    }
    // Stage 3: Confirmation complete (ONLY if confirmation was actually done)
    else if (confirmationComplete && !sentStages.has('complete')) {
      emailStage = 'complete'
    }

    // No email needed at this stage
    if (!emailStage) {
      payload.logger.info(`Drug test ${doc.id}: No email stage determined, skipping notifications`)
      return doc
    }

    payload.logger.info(`Drug test ${doc.id}: Email stage determined as "${emailStage}"`)
    payload.logger.info(
      `Drug test ${doc.id}: isInconclusive=${doc.isInconclusive}, screeningStatus=${doc.screeningStatus}, isComplete=${doc.isComplete}`,
    )

    // For screened and complete stages, require appropriate document before sending ANY emails
    if (emailStage === 'screened') {
      const testDocumentId =
        typeof doc.testDocument === 'string' ? doc.testDocument : doc.testDocument?.id

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
      const testDocId =
        typeof doc.testDocument === 'string' ? doc.testDocument : doc.testDocument?.id

      if (!confirmationDocId && !testDocId) {
        payload.logger.warn(
          `Email notifications pending for drug test ${doc.id}: Upload confirmation document (or test document) to send final emails`,
        )
        return doc
      }
    }

    // Fetch client and recipients
    const clientId =
      typeof doc.relatedClient === 'string' ? doc.relatedClient : doc.relatedClient.id
    let client: any
    try {
      client = await payload.findByID({
        collection: 'clients',
        id: clientId,
        depth: 0,
      })

      if (!client) {
        payload.logger.error(
          `Cannot send notifications: Client ${clientId} not found for drug test ${doc.id}`,
        )
        return doc
      }
    } catch (dbError) {
      payload.logger.error(
        `Database error fetching client ${clientId} for drug test ${doc.id}:`,
        dbError,
      )
      return doc
    }

    const { clientEmail, referralEmails } = await getRecipients(clientId, payload)

    // Fetch client headshot and convert to Base64 data URI for email embedding
    const clientHeadshotDataUri = await fetchClientHeadshot(clientId, payload)
    payload.logger.info(`Drug test ${doc.id}: clientHeadshotDataUri is ${clientHeadshotDataUri ? 'SET' : 'NULL'} (length: ${clientHeadshotDataUri?.length || 0})`)

    // Warn if no referrals found (but continue with client email)
    if (referralEmails.length === 0) {
      payload.logger.warn(
        `No referral recipients found for drug test ${doc.id} - client type: ${client.clientType}`,
      )

      // Alert for business-critical client types that should have referrals
      if (client.clientType === 'probation' || client.clientType === 'employment') {
        await createAdminAlert(payload, {
          severity: 'high',
          alertType: 'recipient-fetch-failure',
          title: `No referral emails for ${client.clientType} client`,
          message: `Drug test ${doc.id} for ${client.clientName} (client type: ${client.clientType}) has no referral email addresses configured. ${client.clientType === 'probation' ? 'Court officers' : 'Employers'} will not receive test results notifications.`,
          context: {
            drugTestId: doc.id,
            clientId: clientId,
            clientName: client.clientName,
            clientType: client.clientType,
            emailStage: emailStage,
          },
        })
      }
    }

    // Build email content based on stage
    const clientName = `${client.firstName} ${client.lastName}`
    const clientDob = client.dob || null
    let clientEmailData: { subject: string; html: string } | null = null
    let referralEmailData: { subject: string; html: string } | null = null

    if (emailStage === 'collected') {
      // Only referrals get "collected" emails - clients don't need notification yet
      const emailData = buildCollectedEmail({
        clientName,
        collectionDate: doc.collectionDate!,
        testType: doc.testType,
        breathalyzerTaken: doc.breathalyzerTaken || false,
        breathalyzerResult: doc.breathalyzerResult ?? null,
        clientHeadshotDataUri,
        clientDob,
      })
      referralEmailData = emailData
    } else if (emailStage === 'inconclusive') {
      // Both client and referrals get inconclusive notifications
      payload.logger.info(
        `Drug test ${doc.id}: Building inconclusive email for client and referrals`,
      )
      const emails = buildInconclusiveEmail({
        clientName,
        collectionDate: doc.collectionDate!,
        testType: doc.testType,
        reason: doc.processNotes || undefined,
        breathalyzerTaken: doc.breathalyzerTaken || false,
        breathalyzerResult: doc.breathalyzerResult ?? null,
        clientHeadshotDataUri,
        clientDob,
      })
      clientEmailData = emails.client
      referralEmailData = emails.referrals
      payload.logger.info(`Drug test ${doc.id}: Inconclusive emails built successfully`)
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
        confirmationDecision: doc.confirmationDecision as 'accept' | 'request-confirmation' | 'pending-decision' | null | undefined,
        breathalyzerTaken: doc.breathalyzerTaken || false,
        breathalyzerResult: doc.breathalyzerResult ?? null,
        clientHeadshotDataUri,
        clientDob,
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
        breathalyzerTaken: doc.breathalyzerTaken || false,
        breathalyzerResult: doc.breathalyzerResult ?? null,
        clientHeadshotDataUri,
        clientDob,
      })
      clientEmailData = emails.client
      referralEmailData = emails.referrals
    }

    // Send emails and track recipients
    let sentTo: string[] = []

    // For "collected" and "inconclusive" stages, send notification without attachment
    if (emailStage === 'collected' || emailStage === 'inconclusive') {
      payload.logger.info(`Drug test ${doc.id}: Sending ${emailStage} emails without attachment`)

      const emailResult = await sendEmails({
        payload,
        clientEmail: emailStage === 'inconclusive' ? clientEmail : null,
        clientEmailData: emailStage === 'inconclusive' ? clientEmailData : null,
        referralEmails,
        referralEmailData: referralEmailData!,
        emailStage,
        drugTestId: doc.id,
        clientId,
        clientName,
      })

      sentTo = emailResult.sentTo
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
        const testDocId =
          typeof doc.testDocument === 'string' ? doc.testDocument : doc.testDocument?.id

        documentId = confirmationDocId || testDocId
      }

      if (!documentId) {
        payload.logger.warn(
          `No document attached for drug test ${doc.id} (stage: ${emailStage}) - skipping all emails`,
        )
      } else {
        try {
          // Fetch document using service layer
          const document = await fetchDocument(documentId, payload)

          payload.logger.info(`Attaching test document: ${document.filename}`)

          // Send emails with attachment
          const emailResult = await sendEmails({
            payload,
            clientEmail,
            clientEmailData,
            referralEmails,
            referralEmailData: referralEmailData!,
            attachment: {
              filename: document.filename,
              content: document.buffer,
              contentType: document.mimeType,
            },
            emailStage,
            drugTestId: doc.id,
            clientId,
            clientName,
          })

          sentTo = emailResult.sentTo
        } catch (documentError) {
          payload.logger.error(
            `CRITICAL: Cannot send notifications for drug test ${doc.id} - document fetch failed:`,
            documentError,
          )

          // Alert admin about document fetch failure
          await createAdminAlert(payload, {
            severity: 'critical',
            alertType: 'document-missing',
            title: `Test document fetch failed - ${clientName}`,
            message: `CRITICAL: Cannot send ${emailStage} results emails because test document could not be fetched.\n\nDocument ID: ${documentId}\nDrug Test ID: ${doc.id}\nClient: ${clientName}\nStage: ${emailStage}\nError: ${documentError instanceof Error ? documentError.message : String(documentError)}\n\nThe document may be missing from storage, or there may be a network/permissions issue. Client and referrals cannot receive results until this is resolved.`,
            context: {
              drugTestId: doc.id,
              clientId: clientId,
              clientName: clientName,
              documentId: documentId,
              emailStage: emailStage,
              issueType: 'document-fetch-failed',
              errorMessage: documentError instanceof Error ? documentError.message : String(documentError),
              errorStack: documentError instanceof Error ? documentError.stack : undefined,
            },
          })
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

    try {
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
    } catch (updateError) {
      payload.logger.error(
        `CRITICAL: Emails sent to ${sentTo.join(', ')} but failed to update notification history for drug test ${doc.id}:`,
        updateError,
      )

      // Alert admin about notification history update failure
      await createAdminAlert(payload, {
        severity: 'high',
        alertType: 'notification-history-failure',
        title: `Notification history update failed - ${clientName}`,
        message: `HIGH: Emails were sent successfully but failed to update notification history.\n\nDrug Test ID: ${doc.id}\nClient: ${clientName}\nStage: ${emailStage}\nRecipients: ${sentTo.join(', ')}\n\nRISK: On next save, the system may try to resend these emails because it has no record they were sent. This could result in duplicate notifications to clients and referrals.\n\nACTION: Manually verify the notification history for this drug test and update if needed to prevent duplicates.`,
        context: {
          drugTestId: doc.id,
          clientId: clientId,
          clientName: clientName,
          emailStage: emailStage,
          recipients: sentTo,
          errorMessage: updateError instanceof Error ? updateError.message : String(updateError),
          errorStack: updateError instanceof Error ? updateError.stack : undefined,
        },
      })
    }
  } catch (error) {
    // Log error but don't fail the save
    payload.logger.error(`Failed to send email notifications for drug test ${doc.id}:`, error)
  }

  return doc
}
