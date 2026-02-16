'use server'

import { getPayload } from 'payload'
import config from '@payload-config'
import type { SubstanceValue } from '@/fields/substanceOptions'
import { computeTestResultPreview } from '@/views/DrugTestWizard/actions'
import { fetchDocument, sendEmails } from '@/collections/DrugTests/services'
import { MedicationSnapshot } from '@/collections/DrugTests/helpers/getActiveMedications'
import { createAdminAlert } from '@/lib/admin-alerts'

/**
 * Create drug test and send approved emails (instant-test workflow final step)
 */
export async function createDrugTestWithEmailReview(
  testData: {
    clientId: string
    testType: '15-panel-instant'
    collectionDate: string
    detectedSubstances: SubstanceValue[]
    isDilute: boolean
    breathalyzerTaken: boolean
    breathalyzerResult: number | null
    pdfBuffer: number[]
    pdfFilename: string
    hasConfirmation?: boolean
    confirmationResults?: Array<{
      substance: SubstanceValue
      result: 'confirmed-positive' | 'confirmed-negative' | 'inconclusive'
      notes?: string
    }>
    confirmationDecision?: 'accept' | 'request-confirmation' | 'pending-decision' | null
    confirmationSubstances?: SubstanceValue[]
  },
  medicationsAtTestTime: MedicationSnapshot[],
  emailConfig: {
    clientEmailEnabled: boolean
    clientRecipients: string[]
    referralEmailEnabled: boolean
    referralRecipients: string[]
  },
): Promise<{
  success: boolean
  testId?: string
  error?: string
}> {
  const payload = await getPayload({ config })

  payload.logger.info('[createDrugTestWithEmailReview] Starting...')

  try {
    // Validate client exists before proceeding
    payload.logger.info('[createDrugTestWithEmailReview] Validating client exists...')
    const existingClient = await payload.findByID({
      collection: 'clients',
      id: testData.clientId,
      depth: 0,
      overrideAccess: true,
    })

    if (!existingClient) {
      return {
        success: false,
        error: 'Client not found. They may have been deleted. Please go back and select a different client.',
      }
    }
    const disableClientEmails = (existingClient as { disableClientEmails?: boolean }).disableClientEmails === true

    // Import email functions
    payload.logger.info('[createDrugTestWithEmailReview] Importing email functions...')
    const { buildScreenedEmail } = await import('@/collections/DrugTests/email/render')
    const { fetchClientHeadshot } = await import('@/collections/DrugTests/email/fetch-headshot')

    // Convert number array back to Buffer
    payload.logger.info('[createDrugTestWithEmailReview] Converting PDF buffer...')
    const buffer = Buffer.from(testData.pdfBuffer)
    payload.logger.info({ msg: '[createDrugTestWithEmailReview] Buffer size', sizeKB: (buffer.length / 1024).toFixed(2) })

    // 1. Upload PDF to private-media collection
    payload.logger.info('[createDrugTestWithEmailReview] Uploading PDF to private-media...')
    const uploadedFile = await payload.create({
      collection: 'private-media',
      data: {
        relatedClient: testData.clientId,
        documentType: 'drug-test-report',
      },
      file: {
        data: buffer,
        mimetype: 'application/pdf',
        name: testData.pdfFilename,
        size: buffer.length,
      },
      overrideAccess: true,
    })
    payload.logger.info({ msg: '[createDrugTestWithEmailReview] PDF uploaded', fileId: uploadedFile.id })

    // 2. Use medications snapshot passed from wizard (already filtered to active meds)
    const medicationsSnapshot = medicationsAtTestTime || []
    payload.logger.info({
      msg: '[createDrugTestWithEmailReview] Using medications snapshot',
      count: medicationsSnapshot.length,
      medications: medicationsSnapshot,
    })

    // 3. Prepare drug test data
    const drugTestData: any = {
      relatedClient: testData.clientId,
      testType: testData.testType,
      collectionDate: testData.collectionDate,
      detectedSubstances: testData.detectedSubstances,
      isDilute: testData.isDilute,
      breathalyzerTaken: testData.breathalyzerTaken,
      breathalyzerResult: testData.breathalyzerResult,
      testDocument: uploadedFile.id,
      screeningStatus: 'screened',
      medicationsArrayAtTestTime: medicationsSnapshot, // CRITICAL: Store medications snapshot
      processNotes: testData.hasConfirmation
        ? 'Created via Drug Test Wizard with email review and lab confirmation results'
        : 'Created via Drug Test Wizard with email review',
      sendNotifications: false, // Prevent auto-send
    }

    // 3. Add confirmation data if present (lab tests with embedded confirmation)
    if (testData.hasConfirmation && testData.confirmationResults && testData.confirmationResults.length > 0) {
      const confirmationSubstances = testData.confirmationResults.map((r) => r.substance)

      drugTestData.confirmationDecision = 'request-confirmation'
      drugTestData.confirmationSubstances = confirmationSubstances
      drugTestData.confirmationResults = testData.confirmationResults.map((r) => ({
        substance: r.substance,
        result: r.result,
        notes: r.notes || undefined,
      }))
    }
    // 3b. Add confirmation decision from wizard (for instant tests with unexpected positives)
    else if (testData.confirmationDecision) {
      drugTestData.confirmationDecision = testData.confirmationDecision
      if (
        testData.confirmationDecision === 'request-confirmation' &&
        testData.confirmationSubstances &&
        testData.confirmationSubstances.length > 0
      ) {
        drugTestData.confirmationSubstances = testData.confirmationSubstances
      }
    }

    // 4. Create drug test record with skipNotificationHook context
    payload.logger.info('[createDrugTestWithEmailReview] Creating drug test record...')
    const drugTest = await payload.create({
      collection: 'drug-tests',
      data: drugTestData,
      overrideAccess: true,
    })
    payload.logger.info({ msg: '[createDrugTestWithEmailReview] Drug test created', testId: drugTest.id })

    // 3. Fetch client for email generation
    const client = await payload.findByID({
      collection: 'clients',
      id: testData.clientId,
      depth: 0,
    })

    // 3a. Fetch client headshot for email embedding
    const clientHeadshotDataUri = await fetchClientHeadshot(testData.clientId, payload)

    // 4. Compute test results for email content using medications snapshot
    payload.logger.info({
      msg: '[createDrugTestWithEmailReview] Computing test results',
      detectedSubstances: testData.detectedSubstances,
      medications: medicationsSnapshot,
    })
    const previewResult = await computeTestResultPreview(
      testData.clientId,
      testData.detectedSubstances,
      testData.testType,
      testData.breathalyzerTaken,
      testData.breathalyzerResult,
      medicationsSnapshot, // Use snapshot from wizard
    )
    payload.logger.info({
      msg: '[createDrugTestWithEmailReview] Test result classification',
      initialScreenResult: previewResult.initialScreenResult,
      expectedPositives: previewResult.expectedPositives,
      unexpectedPositives: previewResult.unexpectedPositives,
      autoAccept: previewResult.autoAccept,
    })

    // 4a. Validate confirmation decision is provided when required
    const hasUnexpectedPositives = previewResult.unexpectedPositives.length > 0
    const requiresDecision = hasUnexpectedPositives && !previewResult.autoAccept

    if (requiresDecision && !testData.confirmationDecision) {
      return {
        success: false,
        error:
          'Confirmation decision is required when unexpected positive substances are detected. Please go back and select how to proceed.',
      }
    }

    // 5. Build email content
    const clientName = `${client.firstName} ${client.lastName}`
    const clientDob = client.dob || null
    const emailData = await buildScreenedEmail({
      clientName,
      collectionDate: testData.collectionDate,
      testType: testData.testType,
      initialScreenResult: previewResult.initialScreenResult,
      detectedSubstances: testData.detectedSubstances,
      expectedPositives: previewResult.expectedPositives,
      unexpectedPositives: previewResult.unexpectedPositives,
      unexpectedNegatives: previewResult.unexpectedNegatives,
      isDilute: testData.isDilute,
      breathalyzerTaken: testData.breathalyzerTaken,
      breathalyzerResult: testData.breathalyzerResult,
      confirmationDecision: testData.confirmationDecision,
      clientHeadshotDataUri,
      clientDob,
    })

    const clientRecipients =
      !disableClientEmails && emailConfig.clientEmailEnabled ? emailConfig.clientRecipients : []
    const referralRecipients = emailConfig.referralEmailEnabled ? emailConfig.referralRecipients : []

    // 6-8. Fetch document and send emails using service layer
    payload.logger.info('[createDrugTestWithEmailReview] Preparing to send emails...')
    let sentTo: string[] = []
    let failedTo: string[] = []

    try {
      // Fetch document using service layer
      payload.logger.info('[createDrugTestWithEmailReview] Fetching document for attachment...')
      const document = await fetchDocument(uploadedFile.id, payload)
      payload.logger.info({ msg: '[createDrugTestWithEmailReview] Document fetched', filename: document.filename })

      // Combine recipients for service call
      // Service will handle client vs referral distinction
      const allClientRecipients = clientRecipients
      const allReferralRecipients = referralRecipients

      // Send emails using service layer
      payload.logger.info({
        msg: '[createDrugTestWithEmailReview] Calling sendEmails...',
        clientRecipients: allClientRecipients.length,
        referralRecipients: allReferralRecipients.length,
      })
      const emailResult = await sendEmails({
        payload,
        clientEmail: allClientRecipients.length > 0 ? allClientRecipients[0] : null,
        clientEmailData: allClientRecipients.length > 0 ? emailData.client : null,
        referralEmails: allReferralRecipients,
        referralEmailData: emailData.referrals,
        attachment: {
          filename: document.filename,
          content: document.buffer,
          contentType: document.mimeType,
        },
        emailStage: 'screened',
        drugTestId: drugTest.id,
        clientId: testData.clientId,
        clientName,
      })
      payload.logger.info({
        msg: '[createDrugTestWithEmailReview] sendEmails completed',
        sentTo: emailResult.sentTo,
        failedRecipients: emailResult.failedRecipients,
      })

      sentTo = emailResult.sentTo
      failedTo = emailResult.failedRecipients
    } catch (documentError) {
      payload.logger.error('Failed to retrieve PDF for email attachment:', documentError)

      // The drug test WAS created successfully, just can't send email with attachment
      return {
        success: false,
        testId: drugTest.id,
        error: `Drug test created but email cannot be sent - PDF file not found in storage. Please check the file exists and retry sending emails manually.`,
      }
    }

    // 9. Update notification history
    const notificationEntry = {
      stage: 'screened',
      sentAt: new Date().toISOString() || null,
      recipients: sentTo.join(', ') || null,
      status: failedTo.length > 0 ? 'failed' : 'sent',
      intendedRecipients:
        [
          ...clientRecipients.map((e) => `Client: ${e}`),
          ...referralRecipients.map((e) => `Referral: ${e}`),
        ].join(', ') || null,
      errorMessage: failedTo.length > 0 ? `Failed to send to: ${failedTo.join(', ')}` : null,
    } as const

    await payload.update({
      collection: 'drug-tests',
      id: drugTest.id,
      data: {
        notificationsSent: [notificationEntry],
      },
      context: {
        skipNotificationHook: true,
      },
      overrideAccess: true,
    })

    // Check for email failures and return appropriate status
    if (failedTo.length > 0 && sentTo.length === 0) {
      // All emails failed
      return {
        success: false,
        testId: drugTest.id,
        error: `Drug test created but all emails failed to send: ${failedTo.join(', ')}. Please send manually or retry.`,
      }
    } else if (failedTo.length > 0) {
      // Some emails failed - return partial success
      return {
        success: false,
        testId: drugTest.id,
        error: `Drug test created and ${sentTo.length} email(s) sent, but ${failedTo.length} failed: ${failedTo.join(', ')}. Please check and resend failed emails.`,
      }
    }

    payload.logger.info({ msg: '[createDrugTestWithEmailReview] Completed successfully', testId: drugTest.id })
    return { success: true, testId: drugTest.id }
  } catch (error) {
    payload.logger.error({ msg: '[createDrugTestWithEmailReview] Unexpected error', error })

    // Create admin alert for unexpected failures
    await createAdminAlert(payload, {
      severity: 'high',
      alertType: 'other',
      title: `Drug test creation failed - Instant Test Workflow`,
      message: `Failed to create drug test via instant test workflow.\n\nClient ID: ${testData.clientId}\nTest Type: ${testData.testType}\nError: ${error instanceof Error ? error.message : String(error)}`,
      context: {
        clientId: testData.clientId,
        testType: testData.testType,
        collectionDate: testData.collectionDate,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
      },
    })

    return {
      success: false,
      error: `Failed to create drug test: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}
