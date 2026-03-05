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
  } catch (error) {
    console.warn('[formatDateForInput] Failed to parse date:', {
      isoDate,
      error: error instanceof Error ? error.message : String(error),
    })
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
  try {
    if (!clientId) {
      throw new Error('Client ID is required to fetch medications')
    }

    const client = await sdk.findByID({
      collection: 'clients',
      id: clientId,
    })

    if (!client) {
      console.error('[getClientMedications] Client not found:', { clientId })
      throw new Error(`Client with ID ${clientId} not found`)
    }

    return normalizeMedications(client.medications)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('[getClientMedications] Failed to fetch medications:', {
      clientId,
      error: errorMessage,
      errorStack: error instanceof Error ? error.stack : undefined,
    })

    // Re-throw with context for TanStack Query to handle
    throw new Error(`Failed to load medications: ${errorMessage}`)
  }
}
