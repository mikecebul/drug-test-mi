'use server'

import { createDrugTestWithEmailReview } from './createDrugTestWithEmailReview'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { SubstanceValue } from '@/fields/substanceOptions'
import { FormMedications } from '../../shared-validators'
import { MedicationSnapshot } from '@/collections/DrugTests/helpers/getActiveMedications'
import { createAdminAlert } from '@/lib/admin-alerts'

// interface MedicationInput {
//   medicationName: string
//   startDate: string | null
//   endDate: string | null
//   status: 'active' | 'discontinued'
//   detectedAs?: string[]
//   requireConfirmation?: boolean
//   notes?: string
// }

export async function createInstantTest(
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
  medications: FormMedications,
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

  const pdfSizeKB = (testData.pdfBuffer.length / 1024).toFixed(2)
  payload.logger.info({
    msg: '[createInstantTest] Server action called',
    clientId: testData.clientId,
    pdfSizeKB: `${pdfSizeKB}KB`,
    medicationsCount: medications.length,
    emailConfig: {
      clientEnabled: emailConfig.clientEmailEnabled,
      clientRecipients: emailConfig.clientRecipients.length,
      referralEnabled: emailConfig.referralEmailEnabled,
      referralRecipients: emailConfig.referralRecipients.length,
    },
  })

  try {
    // 1. Update client medications if provided
    if (medications.length > 0) {
      payload.logger.info('[createInstantTest] Updating client medications...')
      await payload.update({
        collection: 'clients',
        id: testData.clientId,
        data: { medications },
        overrideAccess: true,
      })
      payload.logger.info('[createInstantTest] Medications updated')
    }

    // 3. Prepare medications snapshot for test (active medications only)
    const medicationsAtTestTime: MedicationSnapshot[] = medications
      .filter((med) => med.status === 'active')
      .map((med) => ({
        medicationName: med.medicationName,
        detectedAs: med.detectedAs || [],
        required: med.requireConfirmation ?? false,
        id: undefined
      }))

    // 3. Create drug test using existing action
    payload.logger.info('[createInstantTest] Calling createDrugTestWithEmailReview...')
    const result = await createDrugTestWithEmailReview(testData, medicationsAtTestTime, emailConfig)
    payload.logger.info({ msg: '[createInstantTest] Result from createDrugTestWithEmailReview', success: result.success, testId: result.testId, error: result.error })

    return result
  } catch (error) {
    payload.logger.error({ msg: '[createInstantTest] Unexpected error', error })

    await createAdminAlert(payload, {
      severity: 'high',
      alertType: 'other',
      title: `Instant test submission failed`,
      message: `Failed during instant test submission (before drug test creation).\n\nClient ID: ${testData.clientId}\nError: ${error instanceof Error ? error.message : String(error)}`,
      context: {
        clientId: testData.clientId,
        testType: testData.testType,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
      },
    })

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    }
  }
}
