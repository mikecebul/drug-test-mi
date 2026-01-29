'use server'

import { getPayload } from 'payload'
import config from '@payload-config'
import { generateTestFilename } from '@/views/PDFUploadWizard/utils/generateFilename'
import { computeTestResultPreview } from '@/views/PDFUploadWizard/actions'
import { fetchDocument, sendEmails } from '@/collections/DrugTests/services'
import { createAdminAlert } from '@/lib/admin-alerts'
import type { FormValues } from '../validators'
import type { ExtractedPdfData } from '@/views/PDFUploadWizard/queries'
import type { SubstanceValue } from '@/fields/substanceOptions'

/**
 * Update existing drug test with screening results and send emails (lab-screen workflow final step)
 */
export async function updateLabScreenWithEmailReview(
  formValues: FormValues,
  extractedData: ExtractedPdfData | undefined,
): Promise<{ success: boolean; testId?: string; error?: string }> {
  const payload = await getPayload({ config })

  try {
    // 1. Get existing test to verify it exists and get client ID
    const existingTest = await payload.findByID({
      collection: 'drug-tests',
      id: formValues.matchCollection.testId,
      overrideAccess: true,
    })

    if (!existingTest) {
      return { success: false, error: 'Drug test not found' }
    }

    const clientId =
      typeof existingTest.relatedClient === 'string' ? existingTest.relatedClient : existingTest.relatedClient.id

    // Validate client still exists
    const existingClient = await payload.findByID({
      collection: 'clients',
      id: clientId,
      depth: 0,
      overrideAccess: true,
    })

    if (!existingClient) {
      return {
        success: false,
        error: 'Client not found. They may have been deleted.',
      }
    }

    // Import email functions
    const { buildScreenedEmail } = await import('@/collections/DrugTests/email/render')
    const { fetchClientHeadshot } = await import('@/collections/DrugTests/email/fetch-headshot')

    // 2. Convert File to buffer and upload PDF
    const arrayBuffer = await formValues.upload.file.arrayBuffer()
    const pdfBuffer = Array.from(new Uint8Array(arrayBuffer))
    const buffer = Buffer.from(pdfBuffer)

    // Generate filename
    const nameParts = formValues.matchCollection.clientName.split(' ')
    const firstName = nameParts[0] || ''
    const lastName = nameParts[nameParts.length - 1] || ''

    const filename = generateTestFilename({
      client: { firstName, lastName },
      collectionDate: formValues.labScreenData.collectionDate,
      testType: formValues.labScreenData.testType as any,
      isConfirmation: false,
    })

    const uploadedFile = await payload.create({
      collection: 'private-media',
      data: {
        relatedClient: clientId,
        documentType: 'drug-test-report',
      },
      file: {
        data: buffer,
        mimetype: 'application/pdf',
        name: filename,
        size: buffer.length,
      },
      overrideAccess: true,
    })

    // 3. Build confirmation results from extracted data (if available)
    const confirmationResults = extractedData?.confirmationResults
      ? extractedData.confirmationResults.map((r) => ({
          substance: r.substance as SubstanceValue,
          result: r.result,
          notes: r.notes,
        }))
      : undefined

    // 4. Prepare update data
    const updateData: any = {
      detectedSubstances: formValues.labScreenData.detectedSubstances as SubstanceValue[],
      isDilute: formValues.labScreenData.isDilute,
      testDocument: uploadedFile.id,
      screeningStatus: 'screened',
      processNotes: `${existingTest.processNotes || ''}\nScreening results uploaded via wizard with email review`,
    }

    // Add confirmation data if present (from PDF extraction)
    if (extractedData?.hasConfirmation && confirmationResults && confirmationResults.length > 0) {
      const confirmationSubstances = confirmationResults.map((r) => r.substance)
      updateData.confirmationDecision = 'request-confirmation'
      updateData.confirmationSubstances = confirmationSubstances
      updateData.confirmationResults = confirmationResults
    }
    // Add confirmation decision from wizard (for tests with unexpected positives)
    else if (formValues.labScreenData.confirmationDecision) {
      updateData.confirmationDecision = formValues.labScreenData.confirmationDecision
      if (
        formValues.labScreenData.confirmationDecision === 'request-confirmation' &&
        formValues.labScreenData.confirmationSubstances &&
        formValues.labScreenData.confirmationSubstances.length > 0
      ) {
        updateData.confirmationSubstances = formValues.labScreenData.confirmationSubstances as SubstanceValue[]
      }
    }

    // 5. Update the drug test
    await payload.update({
      collection: 'drug-tests',
      id: formValues.matchCollection.testId,
      data: updateData,
      overrideAccess: true,
    })

    // 6. Fetch client for email generation
    const client = await payload.findByID({
      collection: 'clients',
      id: clientId,
      depth: 0,
    })

    // 7. Fetch client headshot for email embedding
    const clientHeadshotDataUri = await fetchClientHeadshot(clientId, payload)

    // 8. Get medications from existing test (already stored at collection time)
    const medicationsSnapshot = existingTest.medicationsArrayAtTestTime || []
    payload.logger.info({
      msg: '[updateLabScreenWithEmailReview] Using medications snapshot from existing test',
      count: medicationsSnapshot.length,
      medications: medicationsSnapshot,
    })

    // 9. Compute test results for email content
    const previewResult = await computeTestResultPreview(
      clientId,
      formValues.labScreenData.detectedSubstances as SubstanceValue[],
      formValues.labScreenData.testType,
      existingTest.breathalyzerTaken || false,
      existingTest.breathalyzerResult ?? null,
      medicationsSnapshot as any,
    )

    payload.logger.info({
      msg: '[updateLabScreenWithEmailReview] Test result classification',
      initialScreenResult: previewResult.initialScreenResult,
      expectedPositives: previewResult.expectedPositives,
      unexpectedPositives: previewResult.unexpectedPositives,
      autoAccept: previewResult.autoAccept,
    })

    // 10. Build email content
    const clientName = `${client.firstName} ${client.lastName}`
    const clientDob = client.dob || null
    const emailData = await buildScreenedEmail({
      clientName,
      collectionDate: formValues.labScreenData.collectionDate,
      testType: formValues.labScreenData.testType,
      initialScreenResult: previewResult.initialScreenResult,
      detectedSubstances: formValues.labScreenData.detectedSubstances as SubstanceValue[],
      expectedPositives: previewResult.expectedPositives,
      unexpectedPositives: previewResult.unexpectedPositives,
      unexpectedNegatives: previewResult.unexpectedNegatives,
      isDilute: formValues.labScreenData.isDilute,
      breathalyzerTaken: existingTest.breathalyzerTaken || false,
      breathalyzerResult: existingTest.breathalyzerResult ?? null,
      confirmationDecision: formValues.labScreenData.confirmationDecision,
      clientHeadshotDataUri,
      clientDob,
    })

    // 11. Fetch document and send emails using service layer
    let sentTo: string[] = []
    let failedTo: string[] = []

    try {
      // Fetch document using service layer
      const document = await fetchDocument(uploadedFile.id, payload)

      // Prepare recipient lists based on emailConfig
      const clientRecipients = formValues.emails.clientEmailEnabled ? formValues.emails.clientRecipients : []
      const referralRecipients = formValues.emails.referralEmailEnabled ? formValues.emails.referralRecipients : []

      // Send emails using service layer
      const emailResult = await sendEmails({
        payload,
        clientEmail: clientRecipients.length > 0 ? clientRecipients[0] : null,
        clientEmailData: clientRecipients.length > 0 ? emailData.client : null,
        referralEmails: referralRecipients,
        referralEmailData: emailData.referrals,
        attachment: {
          filename: document.filename,
          content: document.buffer,
          contentType: document.mimeType,
        },
        emailStage: 'screened',
        drugTestId: formValues.matchCollection.testId,
        clientId,
        clientName,
      })

      sentTo = emailResult.sentTo
      failedTo = emailResult.failedRecipients
    } catch (documentError) {
      payload.logger.error('Failed to retrieve PDF for email attachment:', documentError)

      return {
        success: false,
        testId: formValues.matchCollection.testId,
        error: `Test updated but email cannot be sent - PDF file not found in storage. Please check the file exists and retry sending emails manually.`,
      }
    }

    // 12. Update notification history
    const notificationEntry = {
      stage: 'screened',
      sentAt: new Date().toISOString() || null,
      recipients: sentTo.join(', ') || null,
      status: failedTo.length > 0 ? 'failed' : 'sent',
      intendedRecipients:
        [
          ...formValues.emails.clientRecipients.map((e) => `Client: ${e}`),
          ...formValues.emails.referralRecipients.map((e) => `Referral: ${e}`),
        ].join(', ') || null,
      errorMessage: failedTo.length > 0 ? `Failed to send to: ${failedTo.join(', ')}` : null,
    } as const

    await payload.update({
      collection: 'drug-tests',
      id: formValues.matchCollection.testId,
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
      return {
        success: false,
        testId: formValues.matchCollection.testId,
        error: `Test updated but all emails failed to send: ${failedTo.join(', ')}. Please send manually or retry.`,
      }
    } else if (failedTo.length > 0) {
      return {
        success: false,
        testId: formValues.matchCollection.testId,
        error: `Test updated and ${sentTo.length} email(s) sent, but ${failedTo.length} failed: ${failedTo.join(', ')}. Please check and resend failed emails.`,
      }
    }

    return {
      success: true,
      testId: formValues.matchCollection.testId,
    }
  } catch (error) {
    payload.logger.error('Error updating lab screen with email review:', error)

    await createAdminAlert(payload, {
      severity: 'high',
      alertType: 'other',
      title: `Lab screen submission failed`,
      message: `Failed to update drug test with lab screening results.\n\nTest ID: ${formValues.matchCollection.testId}\nClient: ${formValues.matchCollection.clientName}\nError: ${error instanceof Error ? error.message : String(error)}`,
      context: {
        testId: formValues.matchCollection.testId,
        clientName: formValues.matchCollection.clientName,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
      },
    })

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update test record',
    }
  }
}
