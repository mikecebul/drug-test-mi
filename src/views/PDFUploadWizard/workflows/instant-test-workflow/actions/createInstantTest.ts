'use server'

import { createDrugTestWithEmailReview } from '@/views/PDFUploadWizard/actions'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { SubstanceValue } from '@/fields/substanceOptions'

interface MedicationInput {
  medicationName: string
  startDate: string | null
  endDate: string | null
  status: 'active' | 'discontinued'
}

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
  medications: MedicationInput[],
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
      const cleanedMedications = medications.map((med) => ({
        medicationName: med.medicationName,
        startDate: med.startDate ?? undefined,
        endDate: med.endDate,
        status: med.status,
        createdAt: new Date().toISOString(),
        detectedAs: [],
        requireConfirmation: false,
        notes: '',
      }))

      await payload.update({
        collection: 'clients',
        id: testData.clientId,
        data: { medications: cleanedMedications as any },
        overrideAccess: true,
      })
    }

    // 2. Create drug test using existing action
    const result = await createDrugTestWithEmailReview(testData, emailConfig)

    return result
  } catch (error) {
    console.error('Error creating instant test:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    }
  }
}
