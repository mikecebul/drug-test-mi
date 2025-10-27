export type EmailStage = 'collected' | 'screened' | 'complete'

export type CollectedEmailData = {
  clientName: string
  collectionDate: string
  testType: string
}

export type ScreenedEmailData = CollectedEmailData & {
  initialScreenResult: string
  detectedSubstances: string[]
  expectedPositives: string[]
  unexpectedPositives: string[]
  unexpectedNegatives: string[]
  isDilute: boolean
}

export type CompleteEmailData = ScreenedEmailData & {
  confirmationResults?: ConfirmationResult[]
  finalStatus: string
}

export type ConfirmationResult = {
  substance: string
  result: string
  notes?: string
}

export type EmailOutput = {
  client: { subject: string; html: string }
  referrals: { subject: string; html: string }
}
