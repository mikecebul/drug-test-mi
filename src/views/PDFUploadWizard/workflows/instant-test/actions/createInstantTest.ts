'use server'

import { createDrugTestWithEmailReview } from './createDrugTestWithEmailReview'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { SubstanceValue } from '@/fields/substanceOptions'
import { FormMedications } from '../../shared-validators'
import { MedicationSnapshot } from '@/collections/DrugTests/helpers/getActiveMedications'

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

  try {
    // 1. Update client medications if provided
    if (medications.length > 0) {
      await payload.update({
        collection: 'clients',
        id: testData.clientId,
        data: { medications },
        overrideAccess: true,
      })
    }

    // 2. Prepare medications snapshot for test (active medications only)
    const medicationsAtTestTime: MedicationSnapshot[] = medications
      .filter((med) => med.status === 'active')
      .map((med) => ({
        medicationName: med.medicationName,
        detectedAs: med.detectedAs || [],
        required: med.requireConfirmation ?? false,
        id: undefined
      }))

    // 3. Create drug test using existing action
    const result = await createDrugTestWithEmailReview(testData, medicationsAtTestTime, emailConfig)

    return result
  } catch (error) {
    console.error('Error creating instant test:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    }
  }
}
