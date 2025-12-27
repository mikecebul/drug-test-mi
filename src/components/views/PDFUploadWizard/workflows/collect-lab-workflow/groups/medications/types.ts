import { format, parseISO } from 'date-fns'
import { sdk } from '@/lib/payload-sdk'
import type { Client } from '@/payload-types'

// Type for medication with UI state flags
export type MedicationWithUIState = {
  medicationName: string
  startDate: string
  endDate?: string | null
  status: 'active' | 'discontinued'
  detectedAs?: string[] | null
  requireConfirmation?: boolean | null
  notes?: string | null
  createdAt?: string | null
  // UI state flags (not persisted to server)
  _isNew?: boolean
  _wasDiscontinued?: boolean
}

// Helper to get today's date in YYYY-MM-DD format
export const getTodayDateString = (): string => format(new Date(), 'yyyy-MM-dd')

// Helper to convert ISO date string to YYYY-MM-DD format for date inputs
export const formatDateForInput = (isoDate: string | null | undefined): string => {
  if (!isoDate) return ''
  try {
    return format(parseISO(isoDate), 'yyyy-MM-dd')
  } catch {
    return ''
  }
}

// Helper to normalize medications from Payload API to form schema
export const normalizeMedications = (meds: Client['medications']): MedicationWithUIState[] => {
  if (!meds) return []
  return meds.map((med) => ({
    ...med,
    startDate: formatDateForInput(med.startDate),
    endDate: formatDateForInput(med.endDate),
    _isNew: false,
    _wasDiscontinued: med.status === 'discontinued',
  }))
}

// Fetch client medications from API
export const getClientMedications = async (clientId: string) => {
  const client = await sdk.findByID({
    collection: 'clients',
    id: clientId,
  })
  return normalizeMedications(client.medications)
}
