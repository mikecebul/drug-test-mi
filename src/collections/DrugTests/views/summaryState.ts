import type { DrugTest } from '@/payload-types'
import { formatSubstances } from '@/lib/substances'
import { isConfirmationComplete } from '../helpers/confirmationStatus'

type BadgeVariant = 'secondary' | 'warning' | 'destructive' | 'outline'

type WorkflowStageId =
  | 'invalid-sample'
  | 'awaiting-lab-screening'
  | 'awaiting-screening-entry'
  | 'screened'
  | 'awaiting-decision'
  | 'confirmation-pending'
  | 'confirmation-complete'
  | 'complete'
  | 'needs-review'

type SummaryResultKey =
  | 'negative'
  | 'expected-positive'
  | 'confirmed-negative'
  | 'unexpected-positive'
  | 'unexpected-negative-critical'
  | 'unexpected-negative-warning'
  | 'mixed-unexpected'
  | 'inconclusive'
  | 'pending'

type ConfirmationDecision = 'pending-decision' | 'accept' | 'request-confirmation' | null

type ConfirmationResultRow = {
  substance: string
  result: string
}

export type DrugTestSummaryInput = Partial<DrugTest>

export type DrugTestSummaryState = {
  workflowStage: {
    id: WorkflowStageId
    label: string
  }
  result: {
    key: SummaryResultKey
    label: string
    source: 'final' | 'initial' | 'pending'
    variant: BadgeVariant
  }
  confirmationProgress: {
    decision: ConfirmationDecision
    requested: number
    completed: number
    isComplete: boolean
  }
  findings: {
    detectedSubstances: string[]
    expectedPositives: string[]
    unexpectedPositives: string[]
    unexpectedNegatives: string[]
  }
  nextStep: string
  blockingFlags: string[]
  screeningStatus: DrugTest['screeningStatus']
  isLabTest: boolean
  isComplete: boolean
  testTypeLabel: string
  clientDisplayName: string
}

const LAB_TEST_TYPES = new Set<DrugTest['testType']>(['11-panel-lab', '17-panel-sos-lab', 'etg-lab'])
const UNEXPECTED_REQUIRES_DECISION = new Set<NonNullable<DrugTest['initialScreenResult']>>([
  'unexpected-positive',
  'unexpected-negative-critical',
  'mixed-unexpected',
])

const RESULT_META: Record<SummaryResultKey, { label: string; variant: BadgeVariant }> = {
  negative: { label: 'Negative (Pass)', variant: 'secondary' },
  'expected-positive': { label: 'Expected Positive (Pass)', variant: 'secondary' },
  'confirmed-negative': { label: 'Confirmed Negative (Pass)', variant: 'secondary' },
  'unexpected-positive': { label: 'Unexpected Positive (Fail)', variant: 'destructive' },
  'unexpected-negative-critical': { label: 'Unexpected Negative - Critical (Fail)', variant: 'destructive' },
  'unexpected-negative-warning': { label: 'Unexpected Negative - Warning', variant: 'warning' },
  'mixed-unexpected': { label: 'Mixed Unexpected (Fail)', variant: 'destructive' },
  inconclusive: { label: 'Inconclusive', variant: 'outline' },
  pending: { label: 'Pending Results', variant: 'outline' },
}

const TEST_TYPE_LABELS: Record<DrugTest['testType'], string> = {
  '11-panel-lab': '11-Panel Lab',
  '15-panel-instant': '15-Panel Instant',
  '17-panel-sos-lab': '17-Panel SOS Lab',
  'etg-lab': 'EtG Lab',
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
}

function asConfirmationRows(value: unknown): ConfirmationResultRow[] {
  if (!Array.isArray(value)) return []

  return value.map((item) => {
    const row = typeof item === 'object' && item !== null ? (item as Record<string, unknown>) : {}
    return {
      substance: typeof row.substance === 'string' ? row.substance : '',
      result: typeof row.result === 'string' ? row.result : '',
    }
  })
}

function resolveClientDisplayName(doc: DrugTestSummaryInput): string {
  if (typeof doc.clientName === 'string' && doc.clientName.trim().length > 0) {
    return doc.clientName.trim()
  }

  if (doc.relatedClient && typeof doc.relatedClient === 'object') {
    const firstName = typeof doc.relatedClient.firstName === 'string' ? doc.relatedClient.firstName : ''
    const middleInitial =
      typeof doc.relatedClient.middleInitial === 'string' && doc.relatedClient.middleInitial
        ? `${doc.relatedClient.middleInitial}. `
        : ''
    const lastName = typeof doc.relatedClient.lastName === 'string' ? doc.relatedClient.lastName : ''
    const fullName = `${firstName} ${middleInitial}${lastName}`.trim()
    if (fullName.length > 0) return fullName
  }

  return 'Unknown Client'
}

function resolveResult(
  doc: DrugTestSummaryInput,
): {
  key: SummaryResultKey
  source: 'final' | 'initial' | 'pending'
} {
  if (doc.isInconclusive) {
    return { key: 'inconclusive', source: 'final' }
  }

  if (typeof doc.finalStatus === 'string' && doc.finalStatus in RESULT_META) {
    return { key: doc.finalStatus as SummaryResultKey, source: 'final' }
  }

  if (typeof doc.initialScreenResult === 'string' && doc.initialScreenResult in RESULT_META) {
    return { key: doc.initialScreenResult as SummaryResultKey, source: 'initial' }
  }

  return { key: 'pending', source: 'pending' }
}

function resolveWorkflowStage(args: {
  isInconclusive: boolean
  isComplete: boolean
  isLabTest: boolean
  screeningStatus: DrugTest['screeningStatus']
  initialScreenResult: DrugTest['initialScreenResult']
  confirmationDecision: ConfirmationDecision
  confirmationComplete: boolean
}): { id: WorkflowStageId; label: string } {
  const {
    isInconclusive,
    isComplete,
    isLabTest,
    screeningStatus,
    initialScreenResult,
    confirmationDecision,
    confirmationComplete,
  } = args

  if (isInconclusive) {
    return { id: 'invalid-sample', label: 'Invalid Sample' }
  }

  if (isComplete || screeningStatus === 'complete') {
    return { id: 'complete', label: 'Complete' }
  }

  if (screeningStatus === 'collected') {
    return isLabTest
      ? { id: 'awaiting-lab-screening', label: 'Awaiting Lab Screening' }
      : { id: 'awaiting-screening-entry', label: 'Awaiting Screening Entry' }
  }

  if (confirmationDecision === 'request-confirmation') {
    return confirmationComplete
      ? { id: 'confirmation-complete', label: 'Confirmation Complete' }
      : { id: 'confirmation-pending', label: 'Confirmation Pending' }
  }

  if (
    initialScreenResult &&
    UNEXPECTED_REQUIRES_DECISION.has(initialScreenResult) &&
    (!confirmationDecision || confirmationDecision === 'pending-decision')
  ) {
    return { id: 'awaiting-decision', label: 'Awaiting Decision' }
  }

  if (screeningStatus === 'screened') {
    return { id: 'screened', label: 'Screened' }
  }

  return { id: 'needs-review', label: 'Needs Review' }
}

function resolveNextStep(args: {
  isInconclusive: boolean
  isLabTest: boolean
  screeningStatus: DrugTest['screeningStatus']
  initialScreenResult: DrugTest['initialScreenResult']
  confirmationDecision: ConfirmationDecision
  confirmationRequestedCount: number
  confirmationComplete: boolean
  isComplete: boolean
}): string {
  const {
    isInconclusive,
    isLabTest,
    screeningStatus,
    initialScreenResult,
    confirmationDecision,
    confirmationRequestedCount,
    confirmationComplete,
    isComplete,
  } = args

  if (isInconclusive) {
    return 'Sample marked invalid; schedule a new collection and keep this record as completed inconclusive.'
  }

  if (screeningStatus === 'collected' && isLabTest) {
    return 'Await lab report, then upload the screening document to move this test to screened.'
  }

  if (screeningStatus === 'collected' && !isLabTest) {
    return 'Enter initial screening findings and save to compute result classification.'
  }

  if (
    screeningStatus === 'screened' &&
    initialScreenResult &&
    UNEXPECTED_REQUIRES_DECISION.has(initialScreenResult) &&
    (!confirmationDecision || confirmationDecision === 'pending-decision')
  ) {
    return 'Record confirmation decision: accept current results or request confirmation testing.'
  }

  if (confirmationDecision === 'request-confirmation' && confirmationRequestedCount === 0) {
    return 'Select substances for confirmation so the lab confirmation request can proceed.'
  }

  if (confirmationDecision === 'request-confirmation' && !confirmationComplete) {
    return 'Enter remaining confirmation outcomes and upload confirmation report when available.'
  }

  if (isComplete) {
    return 'No additional workflow action required; verify notification history is complete.'
  }

  return 'Review required screening/confirmation fields and save to re-evaluate workflow status.'
}

function resolveBlockingFlags(args: {
  isInconclusive: boolean
  isComplete: boolean
  screeningStatus: DrugTest['screeningStatus']
  initialScreenResult: DrugTest['initialScreenResult']
  finalStatus: DrugTest['finalStatus']
  confirmationDecision: ConfirmationDecision
  confirmationRows: ConfirmationResultRow[]
  confirmationRequestedCount: number
  confirmationCompletedCount: number
}): string[] {
  const {
    isInconclusive,
    isComplete,
    screeningStatus,
    initialScreenResult,
    finalStatus,
    confirmationDecision,
    confirmationRows,
    confirmationRequestedCount,
    confirmationCompletedCount,
  } = args

  const flags: string[] = []

  if (screeningStatus === 'collected' && initialScreenResult) {
    flags.push('Status is collected, but an initial screen result is already set.')
  }

  if (
    !isInconclusive &&
    (screeningStatus === 'screened' ||
      screeningStatus === 'confirmation-pending' ||
      screeningStatus === 'complete') &&
    !initialScreenResult
  ) {
    flags.push('Status indicates screening progress, but initial screen result is missing.')
  }

  if (screeningStatus === 'complete' && !isComplete) {
    flags.push('Status is complete, but completion flag is not set.')
  }

  if (!isInconclusive && isComplete && screeningStatus !== 'complete') {
    flags.push('Completion flag is set, but status is not complete.')
  }

  if (confirmationDecision === 'request-confirmation' && confirmationRequestedCount === 0) {
    flags.push('Confirmation testing was requested, but no substances are selected.')
  }

  if (confirmationDecision === 'request-confirmation' && confirmationCompletedCount > confirmationRequestedCount) {
    flags.push('More confirmation results are present than requested substances.')
  }

  if (
    confirmationDecision === 'request-confirmation' &&
    confirmationRows.length > 0 &&
    confirmationCompletedCount < confirmationRows.length
  ) {
    flags.push('One or more confirmation result rows are incomplete.')
  }

  if (confirmationDecision !== 'request-confirmation' && confirmationRows.length > 0) {
    flags.push('Confirmation results exist, but confirmation is not marked as requested.')
  }

  if (!isInconclusive && finalStatus && !isComplete) {
    flags.push('Final status is present while test is not marked complete.')
  }

  if (isInconclusive && finalStatus && finalStatus !== 'inconclusive') {
    flags.push('Inconclusive sample should have final status set to inconclusive.')
  }

  return flags
}

export function buildDrugTestSummaryState(doc: DrugTestSummaryInput): DrugTestSummaryState {
  const isInconclusive = Boolean(doc.isInconclusive)
  const isComplete = Boolean(doc.isComplete)
  const screeningStatus =
    doc.screeningStatus || (doc.initialScreenResult ? 'screened' : 'collected')
  const testType = doc.testType
  const isLabTest = Boolean(testType && LAB_TEST_TYPES.has(testType))
  const confirmationDecision = (doc.confirmationDecision ?? null) as ConfirmationDecision

  const confirmationSubstances = asStringArray(doc.confirmationSubstances)
  const confirmationRows = asConfirmationRows(doc.confirmationResults)
  const confirmationCompletedCount = confirmationRows.filter(
    (row) => row.substance.length > 0 && row.result.length > 0,
  ).length
  const confirmationComplete = isConfirmationComplete(
    confirmationDecision || undefined,
    confirmationSubstances,
    confirmationRows,
  )

  const findings = {
    detectedSubstances: formatSubstances(asStringArray(doc.detectedSubstances), true),
    expectedPositives: formatSubstances(asStringArray(doc.expectedPositives), true),
    unexpectedPositives: formatSubstances(asStringArray(doc.unexpectedPositives), true),
    unexpectedNegatives: formatSubstances(asStringArray(doc.unexpectedNegatives), true),
  }

  const resolvedResult = resolveResult(doc)
  const resultMeta = RESULT_META[resolvedResult.key]

  return {
    workflowStage: resolveWorkflowStage({
      isInconclusive,
      isComplete,
      isLabTest,
      screeningStatus,
      initialScreenResult: doc.initialScreenResult,
      confirmationDecision,
      confirmationComplete,
    }),
    result: {
      key: resolvedResult.key,
      label: resultMeta.label,
      source: resolvedResult.source,
      variant: resultMeta.variant,
    },
    confirmationProgress: {
      decision: confirmationDecision,
      requested: confirmationSubstances.length,
      completed: confirmationCompletedCount,
      isComplete: confirmationComplete,
    },
    findings,
    nextStep: resolveNextStep({
      isInconclusive,
      isLabTest,
      screeningStatus,
      initialScreenResult: doc.initialScreenResult,
      confirmationDecision,
      confirmationRequestedCount: confirmationSubstances.length,
      confirmationComplete,
      isComplete,
    }),
    blockingFlags: resolveBlockingFlags({
      isInconclusive,
      isComplete,
      screeningStatus,
      initialScreenResult: doc.initialScreenResult,
      finalStatus: doc.finalStatus,
      confirmationDecision,
      confirmationRows,
      confirmationRequestedCount: confirmationSubstances.length,
      confirmationCompletedCount,
    }),
    screeningStatus,
    isLabTest,
    isComplete,
    testTypeLabel: testType ? TEST_TYPE_LABELS[testType] : 'Unknown Test Type',
    clientDisplayName: resolveClientDisplayName(doc),
  }
}
