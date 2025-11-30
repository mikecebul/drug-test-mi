import type { SubstanceValue } from '@/fields/substanceOptions'

export type WizardStep = 'upload' | 'extract' | 'verify-client' | 'verify-data' | 'confirm'

export interface ClientMatch {
  id: string
  firstName: string
  lastName: string
  middleInitial?: string | null
  email: string
  dob?: string | null
  matchType: 'exact' | 'fuzzy'
  score?: number
}

export interface ParsedPDFData {
  donorName: string | null
  collectionDate: Date | null
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
