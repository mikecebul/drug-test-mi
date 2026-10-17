'use server'

import { requireWizardAdmin } from '../server/requireWizardAdmin'
import type { SubstanceValue } from '@/fields/substanceOptions'
import type { FormMedications } from '../workflows/shared-validators'
import { computeFinalStatus } from '@/collections/DrugTests/services'
import { computeTestResultPreview } from './computeTestResultPreview'
import type { ConfirmationResult } from '@/collections/DrugTests/services/testResults'

/**
 * Get email preview for Step 6 - Review Emails
 */
export async function getEmailPreview(data: {
  clientId: string
  detectedSubstances: SubstanceValue[]
  testType:
    | '15-panel-instant'
    | '17-panel-instant'
    | '11-panel-lab'
    | '11-panel-lab-no-etg'
    | '8-panel-lab'
    | '17-panel-sos-lab'
    | 'etg-lab'
  collectionDate: string
  isDilute: boolean
  breathalyzerTaken?: boolean
  breathalyzerResult?: number | null
  confirmationDecision?: 'accept' | 'request-confirmation' | 'pending-decision' | null
  confirmationSubstances?: string[]
  confirmationPaymentRequired?: boolean
  confirmationHoldUntil?: string | null
  confirmationCompleted?: boolean
  confirmationResults?: ConfirmationResult[]
  medications?: FormMedications
}): Promise<{
  success: boolean
  data?: {
    clientEmail: string
    referralEmails: string[]
    referralTitle: string
    referralPresetId?: string
    hasExplicitReferralRecipients: boolean
    referralRecipientsDetailed: Array<{
      name: string
      email: string
    }>
    clientAdditionalRecipientsDetailed: Array<{
      name: string
      email: string
    }>
    referralType: 'court' | 'employer' | 'self'
    clientHtml: string
    referralHtml: string
    smartGrouping: 'separate' | 'combined'
    clientSubject: string
    referralSubject: string
  }
  error?: string
}> {
  const { payload } = await requireWizardAdmin()

  try {
    // Import email functions
    const { getRecipients } = await import('@/collections/DrugTests/email/recipients')
    const { buildScreenedEmail, buildCompleteEmail } = await import('@/collections/DrugTests/email/render')
    const { fetchClientHeadshot } = await import('@/collections/DrugTests/email/fetch-headshot')

    // Fetch client to determine client type
    const client = await payload.findByID({
      collection: 'clients',
      id: data.clientId,
      depth: 0,
    })

    if (!client || client.id !== data.clientId) {
      return { success: false, error: 'Client not found' }
    }

    // Get recipients using existing helper
    const {
      clientEmail,
      referralEmails,
      referralTitle,
      referralPresetId,
      hasExplicitReferralRecipients,
      referralRecipientsDetailed,
      clientAdditionalRecipientsDetailed,
    } = await getRecipients(data.clientId, payload)

    // Fetch client headshot for email embedding
    const clientHeadshotDataUri = await fetchClientHeadshot(data.clientId, payload, { preview: true })

    // Compute test result preview (for email content)
    const detected = data.detectedSubstances.filter(
      (substance) =>
        !data.confirmationResults?.some((row) => row.substance === substance && row.result === 'confirmed-negative'),
    )
    const previewResult = await computeTestResultPreview(
      data.clientId,
      detected,
      data.testType,
      data.breathalyzerTaken,
      data.breathalyzerResult,
      data.medications, // Pass medications for accurate preview
    )

    // Build email HTML using existing template builder
    const clientName = `${client.firstName} ${client.lastName}`
    const clientDob = client.dob || null
    const template = {
      clientName,
      collectionDate: data.collectionDate,
      testType: data.testType,
      initialScreenResult: previewResult.initialScreenResult,
      detectedSubstances: detected,
      expectedPositives: previewResult.expectedPositives,
      unexpectedPositives: previewResult.unexpectedPositives,
      unexpectedNegatives: previewResult.unexpectedNegatives,
      isDilute: data.isDilute,
      breathalyzerTaken: data.breathalyzerTaken ?? false,
      breathalyzerResult: data.breathalyzerResult ?? null,
      confirmationDecision: data.confirmationDecision,
      confirmationSubstances: data.confirmationSubstances,
      confirmationPaymentRequired: data.confirmationPaymentRequired,
      confirmationHoldUntil: data.confirmationHoldUntil,
      confirmationCompleted: data.confirmationCompleted,
      clientHeadshotDataUri,
      clientDob,
    }
    const emailData = data.confirmationResults?.length
      ? await buildCompleteEmail({
          ...template,
          confirmationResults: data.confirmationResults,
          finalStatus: computeFinalStatus({
            ...previewResult,
            confirmationResults: data.confirmationResults,
            breathalyzerTaken: data.breathalyzerTaken,
            breathalyzerResult: data.breathalyzerResult,
          }),
        })
      : await buildScreenedEmail(template)

    // Determine smart grouping based on referral type
    const smartGrouping = client.referralType === 'self' ? 'combined' : 'separate'
    const referralType =
      client.referralType === 'court' || client.referralType === 'employer' || client.referralType === 'self'
        ? client.referralType
        : 'self'

    return {
      success: true,
      data: {
        clientEmail,
        referralEmails,
        referralTitle,
        referralPresetId,
        hasExplicitReferralRecipients,
        referralRecipientsDetailed,
        clientAdditionalRecipientsDetailed,
        referralType,
        clientHtml: emailData.client.html,
        referralHtml: emailData.referrals.html,
        smartGrouping,
        clientSubject: emailData.client.subject,
        referralSubject: emailData.referrals.subject,
      },
    }
  } catch (error) {
    payload.logger.error('Error generating email preview:', error)
    return {
      success: false,
      error: `Failed to generate email preview: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}

/**
 * Get email preview for collection notification
 */
export async function getCollectionEmailPreview(data: {
  clientId: string
  testType: '11-panel-lab' | '11-panel-lab-no-etg' | '8-panel-lab' | '17-panel-sos-lab' | 'etg-lab'
  collectionDate: string
  breathalyzerTaken?: boolean
  breathalyzerResult?: number | null
}): Promise<{
  success: boolean
  data?: {
    referralEmails: string[]
    referralTitle: string
    referralPresetId?: string
    hasExplicitReferralRecipients: boolean
    referralRecipientsDetailed: Array<{
      name: string
      email: string
    }>
    clientAdditionalRecipientsDetailed: Array<{
      name: string
      email: string
    }>
    referralType: 'court' | 'employer' | 'self'
    referralHtml: string
    referralSubject: string
  }
  error?: string
}> {
  const { payload } = await requireWizardAdmin()

  try {
    // Import email functions
    const { getRecipients } = await import('@/collections/DrugTests/email/recipients')
    const { buildCollectedEmail } = await import('@/collections/DrugTests/email/render')
    const { fetchClientHeadshot } = await import('@/collections/DrugTests/email/fetch-headshot')

    // Fetch client
    const client = await payload.findByID({
      collection: 'clients',
      id: data.clientId,
      depth: 0,
    })

    if (!client || client.id !== data.clientId) {
      return { success: false, error: 'Client not found' }
    }

    // Get recipients using existing helper
    const {
      referralEmails,
      referralTitle,
      referralPresetId,
      hasExplicitReferralRecipients,
      referralRecipientsDetailed,
      clientAdditionalRecipientsDetailed,
    } = await getRecipients(data.clientId, payload)

    // Fetch client headshot for email embedding
    const clientHeadshotDataUri = await fetchClientHeadshot(data.clientId, payload, { preview: true })

    // Build collection email HTML using existing template builder
    const clientName = `${client.firstName} ${client.lastName}`
    const clientDob = client.dob || null
    const dateTimeStr = `${data.collectionDate}`
    const collectionDate = new Date(dateTimeStr).toISOString()

    const emailData = await buildCollectedEmail({
      clientName,
      collectionDate,
      testType: data.testType,
      breathalyzerTaken: data.breathalyzerTaken ?? false,
      breathalyzerResult: data.breathalyzerResult ?? null,
      clientHeadshotDataUri,
      clientDob,
    })

    const referralType =
      client.referralType === 'court' || client.referralType === 'employer' || client.referralType === 'self'
        ? client.referralType
        : 'self'

    return {
      success: true,
      data: {
        referralEmails,
        referralTitle,
        referralPresetId,
        hasExplicitReferralRecipients,
        referralRecipientsDetailed,
        clientAdditionalRecipientsDetailed,
        referralType,
        referralHtml: emailData.html,
        referralSubject: emailData.subject,
      },
    }
  } catch (error) {
    payload.logger.error('Error generating collection email preview:', error)
    return {
      success: false,
      error: `Failed to generate email preview: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}

/**
 * Get email preview for confirmation results
 */
export async function getConfirmationEmailPreview(data: {
  clientId: string
  testId: string
  confirmationResults: Array<{
    substance: SubstanceValue
    result: 'confirmed-positive' | 'confirmed-negative' | 'inconclusive'
    notes?: string
  }>
  adjustedSubstances?: SubstanceValue[] // Optional: substances with confirmed negatives removed
}): Promise<{
  success: boolean
  data?: {
    clientEmail: string
    referralEmails: string[]
    referralTitle: string
    referralPresetId?: string
    hasExplicitReferralRecipients: boolean
    referralRecipientsDetailed: Array<{
      name: string
      email: string
    }>
    clientAdditionalRecipientsDetailed: Array<{
      name: string
      email: string
    }>
    referralType: 'court' | 'employer' | 'self'
    clientHtml: string
    referralHtml: string
    smartGrouping: 'separate' | 'combined'
    clientSubject: string
    referralSubject: string
  }
  error?: string
}> {
  const { payload } = await requireWizardAdmin()

  try {
    // Import email functions
    const { getRecipients } = await import('@/collections/DrugTests/email/recipients')
    const { buildCompleteEmail } = await import('@/collections/DrugTests/email/render')
    const { fetchClientHeadshot } = await import('@/collections/DrugTests/email/fetch-headshot')

    // Fetch the drug test to get initial screening data
    const drugTest = await payload.findByID({
      collection: 'drug-tests',
      id: data.testId,
      depth: 1,
      overrideAccess: true,
    })

    if (!drugTest) {
      return { success: false, error: 'Drug test not found' }
    }

    const client = typeof drugTest.relatedClient === 'object' ? drugTest.relatedClient : null

    if (!client || client.id !== data.clientId) {
      return { success: false, error: 'Client not found' }
    }

    // Get recipients using existing helper
    const {
      clientEmail,
      referralEmails,
      referralTitle,
      referralPresetId,
      hasExplicitReferralRecipients,
      referralRecipientsDetailed,
      clientAdditionalRecipientsDetailed,
    } = await getRecipients(data.clientId, payload)

    // Fetch client headshot for email embedding
    const clientHeadshotDataUri = await fetchClientHeadshot(data.clientId, payload, { preview: true })

    // Use adjusted substances if provided (confirmed negatives removed),
    // otherwise fall back to original detected substances
    const substancesForPreview = data.adjustedSubstances ?? (drugTest.detectedSubstances as SubstanceValue[])

    // Compute initial test result for email (need this for complete email template)
    const previewResult = await computeTestResultPreview(
      data.clientId,
      substancesForPreview,
      drugTest.testType,
      drugTest.breathalyzerTaken || false,
      drugTest.breathalyzerResult ?? null,
      drugTest.medicationsArrayAtTestTime || [],
    )

    // Compute final status using service layer
    const finalStatus = computeFinalStatus({
      initialScreenResult: previewResult.initialScreenResult,
      expectedPositives: previewResult.expectedPositives,
      unexpectedPositives: previewResult.unexpectedPositives,
      confirmationResults: data.confirmationResults.map((r) => ({
        substance: r.substance,
        result: r.result,
        notes: r.notes,
      })),
      breathalyzerTaken: drugTest.breathalyzerTaken || false,
      breathalyzerResult: drugTest.breathalyzerResult ?? null,
    })

    // Build complete email HTML using existing template builder
    const clientName = `${client.firstName} ${client.lastName}`
    const clientDob = client.dob || null
    const emailData = await buildCompleteEmail({
      clientName,
      collectionDate: drugTest.collectionDate || '',
      testType: drugTest.testType,
      initialScreenResult: previewResult.initialScreenResult,
      detectedSubstances: substancesForPreview,
      expectedPositives: previewResult.expectedPositives,
      unexpectedPositives: previewResult.unexpectedPositives,
      unexpectedNegatives: previewResult.unexpectedNegatives,
      confirmationResults: data.confirmationResults.map((r) => ({
        substance: r.substance,
        result: r.result,
        notes: r.notes,
      })),
      finalStatus,
      isDilute: drugTest.isDilute || false,
      breathalyzerTaken: drugTest.breathalyzerTaken || false,
      breathalyzerResult: drugTest.breathalyzerResult ?? null,
      clientHeadshotDataUri,
      clientDob,
    })

    // Determine smart grouping based on referral type
    const smartGrouping = client.referralType === 'self' ? 'combined' : 'separate'
    const referralType =
      client.referralType === 'court' || client.referralType === 'employer' || client.referralType === 'self'
        ? client.referralType
        : 'self'

    return {
      success: true,
      data: {
        clientEmail,
        referralEmails,
        referralTitle,
        referralPresetId,
        hasExplicitReferralRecipients,
        referralRecipientsDetailed,
        clientAdditionalRecipientsDetailed,
        referralType,
        clientHtml: emailData.client.html,
        referralHtml: emailData.referrals.html,
        smartGrouping,
        clientSubject: emailData.client.subject,
        referralSubject: emailData.referrals.subject,
      },
    }
  } catch (error) {
    payload.logger.error('Error generating confirmation email preview:', error)
    return {
      success: false,
      error: `Failed to generate confirmation email preview: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}
