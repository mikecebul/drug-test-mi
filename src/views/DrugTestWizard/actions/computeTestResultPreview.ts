'use server'

import type { SubstanceValue } from '@/fields/substanceOptions'
import { getPayload } from 'payload'
import config from '@payload-config'
import { computeTestResults } from '@/collections/DrugTests/services'
import { FormMedications } from '../workflows/shared-validators'
import { MedicationSnapshot } from '@/collections/DrugTests/helpers/getActiveMedications'

/**
 * Compute test result preview for wizard UI
 *
 * Wrapper around the service layer computeTestResults function.
 * Fetches client's current active medications and uses them for preview.
 * Filters expected substances by test type to only check substances this panel actually screens for.
 * This prevents false "unexpected negatives" for substances not tested by the selected panel.
 */
export async function computeTestResultPreview(
  clientId: string,
  detectedSubstances: SubstanceValue[],
  testType: '15-panel-instant' | '11-panel-lab' | '17-panel-sos-lab' | 'etg-lab',
  breathalyzerTaken?: boolean,
  breathalyzerResult?: number | null,
  medications?: FormMedications,
): Promise<{
  initialScreenResult:
    | 'negative'
    | 'expected-positive'
    | 'unexpected-positive'
    | 'unexpected-negative-critical'
    | 'unexpected-negative-warning'
    | 'mixed-unexpected'
  expectedPositives: string[]
  unexpectedPositives: string[]
  unexpectedNegatives: string[]
  autoAccept: boolean
}> {
  const payload = await getPayload({ config })

  let medicationsAtTestTime: MedicationSnapshot[]

  // Use provided medications if available, otherwise fetch from database
  if (medications) {
    // Use medications from wizard (may have been modified)
    medicationsAtTestTime = medications
  } else {
    // Fetch client's current medications for preview
    const client = await payload.findByID({
      collection: 'clients',
      id: clientId,
      depth: 0,
    })

    // Build medications array from current active medications
    medicationsAtTestTime =
      client?.medications && Array.isArray(client.medications)
        ? client.medications
            .filter((med: any) => med.status === 'active')
            .map((med: any) => ({
              medicationName: med.medicationName,
              detectedAs: med.detectedAs || [],
              required: med.requireConfirmation ?? undefined, // Convert null to undefined
            }))
        : []
  }

  return await computeTestResults({
    clientId,
    detectedSubstances,
    medicationsAtTestTime,
    testType, // Wizard filters by test type (only check substances this panel screens for)
    breathalyzerTaken,
    breathalyzerResult,
    payload,
  })
}
