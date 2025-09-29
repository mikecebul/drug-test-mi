import { Client } from '@/payload-types'

// Extract the medication type from the Payload-generated Client type
export type Medication = NonNullable<Client['medications']>[0]
export type MedicationStatus = Medication['status']

// Form types
export type AddMedicationForm = {
  medicationName: string
  detectedAs: string
  startDate: string
}

export type UpdateMedicationForm = {
  status: MedicationStatus
  endDate?: string
}

export const MEDICATION_STATUS_OPTIONS = [
  { label: 'Active', value: 'active' },
  { label: 'Discontinued', value: 'discontinued' },
]

// Re-export drug test substances for use in components
export { DRUG_TEST_SUBSTANCES, type DrugTestSubstance } from './constants/drugTestSubstances'
