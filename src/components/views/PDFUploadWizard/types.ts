import type { SubstanceValue } from '@/fields/substanceOptions'

export const WIZARD_OPTIONS = [
  '15-panel-instant',
  'collect-lab',
  'enter-lab-screen',
  'enter-lab-confirmation',
] as const

// 1. Create the Type
export type WizardType = (typeof WIZARD_OPTIONS)[number]

export type WizardStep =
  | 'wizard-type'
  | 'upload'
  | 'extract'
  | 'verify-client'
  | 'verify-data'
  | 'confirm'
  | 'review-emails'
  | 'select-test'
  | 'collection-details'

export interface ClientMatch {
  id: string
  firstName: string
  lastName: string
  middleInitial?: string | null
  email: string
  dob?: string | null
  headshot?: string | null // URL to headshot image
  matchType: 'exact' | 'fuzzy'
  score?: number
}

export interface ParsedPDFData {
  donorName: string | null
  collectionDate: string | null // ISO string in UTC
  dob?: string | null // Date of birth in MM/DD/YYYY format (15-panel instant only)
  gender?: string | null // M or F (15-panel instant only)
  detectedSubstances: SubstanceValue[]
  isDilute: boolean
  rawText: string
  confidence: 'high' | 'medium' | 'low'
  extractedFields: string[]
  // Lab-specific fields
  testType?: TestType
  hasConfirmation?: boolean
  confirmationResults?: Array<{
    substance: SubstanceValue
    result: 'confirmed-positive' | 'confirmed-negative' | 'inconclusive'
    notes?: string
  }>
}

export type TestType = '15-panel-instant' | '11-panel-lab' | '17-panel-sos-lab' | 'etg-lab'

export interface VerifiedTestData {
  testType: TestType
  collectionDate: string
  detectedSubstances: SubstanceValue[]
  isDilute: boolean
}
