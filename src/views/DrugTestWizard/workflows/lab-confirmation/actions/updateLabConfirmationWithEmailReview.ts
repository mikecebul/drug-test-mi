'use server'

import { getPayload } from 'payload'
import config from '@payload-config'
import { generateTestFilename } from '@/views/DrugTestWizard/utils/generateFilename'
import { computeTestResultPreview } from '@/views/DrugTestWizard/actions'
import { fetchDocument, sendEmails, computeFinalStatus } from '@/collections/DrugTests/services'
import { createAdminAlert } from '@/lib/admin-alerts'
import type { FormValues } from '../validators'
import type { ExtractedPdfData } from '@/views/DrugTestWizard/queries'
import type { SubstanceValue } from '@/fields/substanceOptions'

/**
 * Update existing drug test with confirmation results and send complete emails
 */
export async function updateLabConfirmationWithEmailReview(
  formValues: FormValues,
  _extractedData: ExtractedPdfData | undefined,
): Promise<{ success: boolean; testId?: string; error?: string }> {
  const payload = await getPayload({ config })

  try {
    // 1. Get existing test
    const existingTest = await payload.findByID({
      collection: 'drug-tests',
      id: formValues.matchCollection.testId,
      overrideAccess: true,
    })

    if (!existingTest) {
      return { success: false, error: 'Drug test not found' }
    }

    // Verify test is in correct status
    if (existingTest.screeningStatus !== 'screened' && existingTest.screeningStatus !== 'confirmation-pending') {
      return {
        success: false,
        error: `Cannot add confirmation to test with status '${existingTest.screeningStatus}'. Test must be 'screened' or 'confirmation-pending'.`,
      }
    }

    const clientId =
      typeof existingTest.relatedClient === 'string' ? existingTest.relatedClient : existingTest.relatedClient.id

    // Validate client exists
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
    const { buildCompleteEmail } = await import('@/collections/DrugTests/email/render')
    const { fetchClientHeadshot } = await import('@/collections/DrugTests/email/fetch-headshot')

    // 2. Upload PDF to confirmationDocument
    const arrayBuffer = await formValues.upload.file.arrayBuffer()
    const pdfBuffer = Array.from(new Uint8Array(arrayBuffer))
    const buffer = Buffer.from(pdfBuffer)

    // Generate filename
    const nameParts = formValues.matchCollection.clientName.split(' ')
    const firstName = nameParts[0] || ''
    const lastName = nameParts[nameParts.length - 1] || ''

    const filename = generateTestFilename({
      client: { firstName, lastName },
      collectionDate: formValues.matchCollection.collectionDate,
      testType: formValues.matchCollection.testType as any,
      isConfirmation: true,
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

    // 3. Compute adjusted substances (remove confirmed-negatives)
    const confirmationResults = formValues.labConfirmationData.confirmationResults.map((r) => ({
      substance: r.substance as SubstanceValue,
      result: r.result,
      notes: r.notes,
    }))

    const originalDetectedSubstances = (existingTest.detectedSubstances || []) as SubstanceValue[]
    const adjustedSubstances = originalDetectedSubstances.filter((substance) => {
      const confirmationResult = confirmationResults.find(
        (r) => r.substance.toLowerCase() === substance.toLowerCase(),
      )
      return !(confirmationResult && confirmationResult.result === 'confirmed-negative')
    })

    payload.logger.info({
      msg: '[updateLabConfirmationWithEmailReview] Adjusted substances',
      originalDetectedSubstances,
      confirmationResults,
      adjustedSubstances,
    })

    // 4. Compute test result preview with adjusted substances
    const medicationsSnapshot = existingTest.medicationsArrayAtTestTime || []
    const previewResult = await computeTestResultPreview(
      clientId,
      adjustedSubstances,
      existingTest.testType as any,
      existingTest.breathalyzerTaken || false,
      existingTest.breathalyzerResult ?? null,
      medicationsSnapshot as any,
    )

    // 5. Compute final status using service layer
    const finalStatus = computeFinalStatus({
      initialScreenResult: previewResult.initialScreenResult,
      expectedPositives: previewResult.expectedPositives,
      unexpectedPositives: previewResult.unexpectedPositives,
      confirmationResults,
      breathalyzerTaken: existingTest.breathalyzerTaken || false,
      breathalyzerResult: existingTest.breathalyzerResult ?? null,
    })

    payload.logger.info({
      msg: '[updateLabConfirmationWithEmailReview] Final status computed',
      finalStatus,
      initialScreenResult: previewResult.initialScreenResult,
    })

    // 6. Update the drug test
    const confirmationSubstances = confirmationResults.map((r) => r.substance)

    await payload.update({
      collection: 'drug-tests',
      id: formValues.matchCollection.testId,
      data: {
        confirmationDocument: uploadedFile.id,
        confirmationDecision: 'request-confirmation',
        confirmationSubstances,
        confirmationResults,
        screeningStatus: 'complete',
        finalStatus,
        processNotes: `${existingTest.processNotes || ''}\nConfirmation results uploaded via wizard with email review`,
      },
      overrideAccess: true,
    })

    // 7. Fetch client for email generation
    const client = await payload.findByID({
      collection: 'clients',
      id: clientId,
      depth: 0,
    })

    // 8. Fetch client headshot
    const clientHeadshotDataUri = await fetchClientHeadshot(clientId, payload)

    // 9. Build complete email content
    const clientName = `${client.firstName} ${client.lastName}`
    const clientDob = client.dob || null
    const emailData = await buildCompleteEmail({
      clientName,
      collectionDate: existingTest.collectionDate || '',
      testType: existingTest.testType,
      initialScreenResult: previewResult.initialScreenResult,
      detectedSubstances: adjustedSubstances,
      expectedPositives: previewResult.expectedPositives,
      unexpectedPositives: previewResult.unexpectedPositives,
      unexpectedNegatives: previewResult.unexpectedNegatives,
      confirmationResults,
      finalStatus,
      isDilute: existingTest.isDilute || false,
      breathalyzerTaken: existingTest.breathalyzerTaken || false,
      breathalyzerResult: existingTest.breathalyzerResult ?? null,
      clientHeadshotDataUri,
      clientDob,
    })

    // 10. Fetch document and send emails
    let sentTo: string[] = []
    let failedTo: string[] = []

    try {
      const document = await fetchDocument(uploadedFile.id, payload)

      const clientRecipients = formValues.emails.clientEmailEnabled ? formValues.emails.clientRecipients : []
      const referralRecipients = formValues.emails.referralEmailEnabled ? formValues.emails.referralRecipients : []

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
        emailStage: 'complete',
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
        error: `Test updated but email cannot be sent - PDF file not found in storage.`,
      }
    }

    // 11. Update notification history
    const notificationEntry = {
      stage: 'complete',
      sentAt: new Date().toISOString() || null,
      recipients: sentTo.join(', ') || null,
      status: failedTo.length > 0 ? 'failed' : 'sent',
      intendedRecipients: [
        ...formValues.emails.clientRecipients.map((e) => `Client: ${e}`),
        ...formValues.emails.referralRecipients.map((e) => `Referral: ${e}`),
      ].join(', ') || null,
      errorMessage: failedTo.length > 0 ? `Failed to send to: ${failedTo.join(', ')}` : null,
    } as const

    await payload.update({
      collection: 'drug-tests',
      id: formValues.matchCollection.testId,
      data: {
        notificationsSent: [...(existingTest.notificationsSent || []), notificationEntry],
      },
      context: {
        skipNotificationHook: true,
      },
      overrideAccess: true,
    })

    // Check for email failures
    if (failedTo.length > 0 && sentTo.length === 0) {
      return {
        success: false,
        testId: formValues.matchCollection.testId,
        error: `Test updated but all emails failed to send: ${failedTo.join(', ')}`,
      }
    } else if (failedTo.length > 0) {
      return {
        success: false,
        testId: formValues.matchCollection.testId,
        error: `Test updated and ${sentTo.length} email(s) sent, but ${failedTo.length} failed: ${failedTo.join(', ')}`,
      }
    }

    return {
      success: true,
      testId: formValues.matchCollection.testId,
    }
  } catch (error) {
    payload.logger.error('Error updating confirmation with email review:', error)

    await createAdminAlert(payload, {
      severity: 'high',
      alertType: 'other',
      title: `Lab confirmation submission failed`,
      message: `Failed to update drug test with lab confirmation results.\n\nTest ID: ${formValues.matchCollection.testId}\nClient: ${formValues.matchCollection.clientName}\nError: ${error instanceof Error ? error.message : String(error)}`,
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
