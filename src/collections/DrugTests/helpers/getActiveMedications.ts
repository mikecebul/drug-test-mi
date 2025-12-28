import type { Payload } from 'payload'
import type { DrugTest } from '@/payload-types'

/**
 * Type for medication snapshot - extracted from DrugTest type
 */
export type MedicationSnapshot = NonNullable<DrugTest['medicationsArrayAtTestTime']>[number]

/**
 * Fetches active medications from a client and returns a snapshot
 * suitable for storing in a drug test record.
 *
 * @param clientId - The client ID to fetch medications for
 * @param payload - Payload instance
 * @returns Array of active medications with their detected substances
 */
export async function getActiveMedications(
  clientId: string,
  payload: Payload,
): Promise<MedicationSnapshot[]> {
  try {
    const client = await payload.findByID({
      collection: 'clients',
      id: clientId,
      depth: 0,
      overrideAccess: true,
    })

    if (!client?.medications || !Array.isArray(client.medications)) {
      return []
    }

    const activeMeds = client.medications
      .filter((med: any) => med.status === 'active')
      .map((med: any) => ({
        medicationName: med.medicationName,
        detectedAs: med.detectedAs || [],
      }))

    return activeMeds
  } catch (error) {
    console.error('Error fetching client medications:', error)
    return []
  }
}
