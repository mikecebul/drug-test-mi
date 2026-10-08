'use server'

import { headers } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import { confirmationPaymentRequired } from '@/collections/DrugTests/confirmation/policy'
import { generateTestFilename } from '@/views/DrugTestWizard/utils/generateFilename'
import { computeTestResultPreview } from '@/views/DrugTestWizard/actions'
import { fetchDocument, sendEmails } from '@/collections/DrugTests/services'
import { createAdminAlert } from '@/lib/admin-alerts'
import { labScreenDataSchema, type FormValues } from '../validators'
import {
  readLabReportFile,
  verifyLabReportIdentity,
  type ReportIdentityAcknowledgement,
} from '../../components/readLabReport'
import { reconcileConfirmationSubmission, storedConfirmationRows } from '../../components/confirmation-review'
import type { ExtractedPdfData } from '@/views/DrugTestWizard/queries'
import type { SubstanceValue } from '@/fields/substanceOptions'

/**
 * Update existing drug test with screening results and send emails (lab-screen workflow final step)
 */
export async function updateLabScreenWithEmailReview(
  formValues: FormValues,
  _extractedData: ExtractedPdfData | undefined,
  acknowledgement?: ReportIdentityAcknowledgement,
): Promise<{ success: boolean; testId?: string; error?: string }> {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await headers() })
  if (!user || user.collection !== 'admins') return { success: false, error: 'Admin access required' }

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
    const disableClientEmails = (existingClient as { disableClientEmails?: boolean }).disableClientEmails === true

    let buffer: Buffer
    let reviewed: ReturnType<typeof reconcileConfirmationSubmission> | undefined
    try {
      const input = labScreenDataSchema.shape.labScreenData.safeParse(formValues.labScreenData)
      if (!input.success)
        return { success: false, error: 'Review the screening and confirmation results before saving' }
      const file = await readLabReportFile(formValues.upload.file)
      await verifyLabReportIdentity(file.report, existingClient, acknowledgement)
      if (file.report.reportKind === 'confirmation')
        return {
          success: false,
          error: 'This report only contains confirmation results. Attach it using Enter Lab Confirmation Data.',
        }
      buffer = file.buffer
      if (file.report.hasConfirmation)
        reviewed = reconcileConfirmationSubmission(
          file.report,
          input.data.confirmationResults,
          existingTest.confirmationSubstances ?? [],
          storedConfirmationRows(existingTest.confirmationResults ?? []),
        )
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Review the lab report' }
    }
    const confirmationResults = reviewed?.results

    const medicationsSnapshot = existingTest.medicationsArrayAtTestTime || []
    const previewResult = await computeTestResultPreview(
      clientId,
      formValues.labScreenData.detectedSubstances as SubstanceValue[],
      formValues.labScreenData.testType,
      existingTest.breathalyzerTaken || false,
      existingTest.breathalyzerResult ?? null,
      medicationsSnapshot as any,
    )
    const decision = formValues.labScreenData.confirmationDecision || (previewResult.autoAccept ? 'accept' : undefined)
    if (!reviewed) {
      if (!decision) return { success: false, error: 'Choose a result decision before saving.' }
      const { prepareConfirmation } = await import('@/collections/DrugTests/confirmation/prepare')
      await prepareConfirmation({
        payload,
        user,
        testId: existingTest.id,
        decision,
        substances: decision === 'request-confirmation' ? formValues.labScreenData.confirmationSubstances || [] : [],
        screenedAt: existingTest.screenedAt || formValues.labScreenData.screeningResultDate || new Date().toISOString(),
      })
    }

    const { buildScreenedEmail } = await import('@/collections/DrugTests/email/render')
    const { fetchClientHeadshot } = await import('@/collections/DrugTests/email/fetch-headshot')

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

    // 4. Prepare update data
    const updateData: any = {
      screenedAt: existingTest.screenedAt || formValues.labScreenData.screeningResultDate || new Date().toISOString(),
      detectedSubstances: formValues.labScreenData.detectedSubstances as SubstanceValue[],
      isDilute: formValues.labScreenData.isDilute,
      testDocument: uploadedFile.id,
      screeningStatus: 'screened',
      processNotes: `${existingTest.processNotes || ''}\nScreening results uploaded via wizard with email review`,
    }

    // Add confirmation data if present (from PDF extraction)
    if (reviewed && confirmationResults && confirmationResults.length > 0) {
      const confirmationSubstances = reviewed.substances
      updateData.confirmationDecision = 'request-confirmation'
      updateData.confirmationSubstances = confirmationSubstances
      updateData.confirmationResults = confirmationResults
    }
    // Add confirmation decision from wizard (for tests with unexpected positives)
    else if (decision) {
      updateData.confirmationDecision = decision
      if (
        formValues.labScreenData.confirmationDecision === 'request-confirmation' &&
        formValues.labScreenData.confirmationSubstances &&
        formValues.labScreenData.confirmationSubstances.length > 0
      ) {
        updateData.confirmationSubstances = formValues.labScreenData.confirmationSubstances as SubstanceValue[]
      }
    }

    // 5. Update the drug test
    const savedTest = await payload.update({
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
      confirmationDecision: savedTest.confirmationDecision,
      confirmationSubstances: savedTest.confirmationSubstances || [],
      confirmationPaymentRequired: confirmationPaymentRequired(savedTest),
      confirmationCompleted: !!savedTest.confirmationResults?.length && savedTest.isComplete === true,
      confirmationHoldUntil: savedTest.confirmationHoldUntil,
      clientHeadshotDataUri,
      clientDob,
    })

    const clientRecipients =
      !disableClientEmails && formValues.emails.clientEmailEnabled ? formValues.emails.clientRecipients : []
    const clientRecipientKeys = new Set(clientRecipients.map((email) => email.trim().toLowerCase()))
    const referralRecipients = formValues.emails.referralEmailEnabled
      ? formValues.emails.referralRecipients.filter((email) => !clientRecipientKeys.has(email.trim().toLowerCase()))
      : []

    // 11. Fetch document and send emails using service layer
    let sentTo: string[] = []
    let failedTo: string[] = []

    try {
      // Fetch document using service layer
      const document = await fetchDocument(uploadedFile.id, payload)

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
        [...clientRecipients.map((e) => `Client: ${e}`), ...referralRecipients.map((e) => `Referral: ${e}`)].join(
          ', ',
        ) || null,
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
