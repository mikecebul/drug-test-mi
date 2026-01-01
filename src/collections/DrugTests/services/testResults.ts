import type { Payload } from 'payload'
import { classifyTestResult } from '../helpers/classifyTestResult'
import { MedicationSnapshot } from '../helpers/getActiveMedications'

// Epsilon threshold for breathalyzer BAC comparisons
// BAC values are reported to 3 decimal places (e.g., 0.080)
// Use 0.0001 to avoid floating point precision issues
const BAC_EPSILON = 0.0001

/**
 * Applies breathalyzer override to test result
 *
 * Positive breathalyzer (BAC > 0.000) always overrides passing results to fail.
 * If the result is already failing, it stays as the existing fail status.
 *
 * @param result - Current test result (InitialScreenResult or FinalStatus)
 * @param breathalyzerTaken - Whether breathalyzer was administered
 * @param breathalyzerResult - BAC value (null if not taken or no result)
 * @returns Overridden result if breathalyzer is positive, otherwise unchanged
 */
function applyBreathalyzerOverride<T extends InitialScreenResult | FinalStatus>(
  result: T,
  breathalyzerTaken?: boolean,
  breathalyzerResult?: number | null,
): T {
  // Only override if breathalyzer was taken and result is positive
  if (!breathalyzerTaken || !breathalyzerResult || breathalyzerResult <= BAC_EPSILON) {
    return result
  }

  // Define passing results that should be overridden
  const passingResults: Array<InitialScreenResult | FinalStatus> = [
    'negative',
    'expected-positive',
    'confirmed-negative',
  ]

  // If currently passing, change to fail
  if (passingResults.includes(result)) {
    return 'unexpected-positive' as T
  }

  // If already failing, keep the existing fail status
  return result
}

export type TestType = '15-panel-instant' | '11-panel-lab' | '17-panel-sos-lab' | 'etg-lab'

export type InitialScreenResult =
  | 'negative'
  | 'expected-positive'
  | 'unexpected-positive'
  | 'unexpected-negative-critical'
  | 'unexpected-negative-warning'
  | 'mixed-unexpected'

export type FinalStatus =
  | 'negative'
  | 'confirmed-negative'
  | 'expected-positive'
  | 'unexpected-positive'
  | 'unexpected-negative-critical'
  | 'unexpected-negative-warning'
  | 'mixed-unexpected'
  | 'inconclusive'

export type ComputeTestResultsParams = {
  clientId: string // Still needed for error messages
  detectedSubstances: string[]
  medicationsAtTestTime: MedicationSnapshot[]
  testType?: TestType // Optional - if provided, filters expected substances by test type
  breathalyzerTaken?: boolean
  breathalyzerResult?: number | null
  payload: Payload
}

export type ComputeTestResultsResult = {
  initialScreenResult: InitialScreenResult
  expectedPositives: string[]
  unexpectedPositives: string[]
  unexpectedNegatives: string[]
  autoAccept: boolean
}

export type ConfirmationResult = {
  substance: string
  result: 'confirmed-positive' | 'confirmed-negative' | 'inconclusive'
  notes?: string
}

export type ComputeFinalStatusParams = {
  initialScreenResult: InitialScreenResult
  expectedPositives: string[]
  unexpectedPositives: string[]
  confirmationResults: ConfirmationResult[]
  breathalyzerTaken?: boolean
  breathalyzerResult?: number | null
}

/**
 * Computes test result classification by comparing detected substances with medications at test time
 *
 * Business Logic:
 * 1. Uses medicationsArrayAtTestTime snapshot (not current medications)
 * 2. Extracts expected substances from medication detectedAs fields
 * 3. Optionally filters by test type (e.g., 15-panel only tests for specific substances)
 * 4. Compares detected substances with expected substances
 * 5. Classifies as: expected positives, unexpected positives, unexpected negatives
 * 6. Determines overall result and whether to auto-accept
 * 7. Applies breathalyzer override if positive
 *
 * @param params - Client ID, detected substances, medications snapshot, optional test type, breathalyzer data, payload
 * @returns Classification result with arrays and auto-accept flag
 */
export async function computeTestResults(params: ComputeTestResultsParams): Promise<ComputeTestResultsResult> {
  const {
    clientId,
    detectedSubstances,
    medicationsAtTestTime,
    testType,
    breathalyzerTaken,
    breathalyzerResult,
    payload,
  } = params

  try {
    // If test type provided, get substances that this test type actually screens for
    let testTypeSubstanceValues: Set<string> | null = null
    if (testType) {
      const { getSubstanceOptions } = await import('@/fields/substanceOptions')
      const testTypeSubstances = getSubstanceOptions(testType)
      testTypeSubstanceValues = new Set(testTypeSubstances.map((s: { value: string }) => s.value))
    }

    // Extract expected substances from medications snapshot at test time
    // Track which substances require confirmation if missing
    const expectedSubstances = new Set<string>()
    const criticalSubstances = new Set<string>() // Substances that MUST show (requireConfirmation = true)

    if (medicationsAtTestTime && Array.isArray(medicationsAtTestTime)) {
      medicationsAtTestTime.forEach((med) => {
        const substances = (med.detectedAs || []).filter((s) => s !== 'none')

        substances.forEach((substance) => {
          // If test type filtering enabled, only include substances this test type screens for
          // This prevents false "missing negatives" for substances not tested by this panel
          if (!testTypeSubstanceValues || testTypeSubstanceValues.has(substance)) {
            expectedSubstances.add(substance)
            if (med.required === true) {
              criticalSubstances.add(substance)
            }
          }
        })
      })
    }

    // Convert to sets for comparison
    const detectedSet = new Set(detectedSubstances)
    const expectedSet = expectedSubstances

    // Compute result arrays
    const expectedPositives: string[] = []
    const unexpectedPositives: string[] = []
    const unexpectedNegatives: string[] = [] // Soft warnings (requireConfirmation = false)
    const criticalNegatives: string[] = [] // Critical failures (requireConfirmation = true)

    // Check detected substances
    detectedSet.forEach((substance) => {
      if (expectedSet.has(substance)) {
        expectedPositives.push(substance)
      } else {
        unexpectedPositives.push(substance)
      }
    })

    // Check for missing expected substances - separate critical vs warning
    expectedSet.forEach((substance) => {
      if (!detectedSet.has(substance)) {
        if (criticalSubstances.has(substance)) {
          criticalNegatives.push(substance)
        } else {
          unexpectedNegatives.push(substance)
        }
      }
    })

    // Determine overall result classification using pure helper function
    const classification = classifyTestResult({
      detectedCount: detectedSet.size,
      expectedCount: expectedSet.size,
      unexpectedPositivesCount: unexpectedPositives.length,
      unexpectedNegativesCount: unexpectedNegatives.length,
      criticalNegativesCount: criticalNegatives.length,
    })

    // Apply breathalyzer override if positive
    const finalResult = applyBreathalyzerOverride(
      classification.initialScreenResult,
      breathalyzerTaken,
      breathalyzerResult,
    )

    // Don't auto-accept if breathalyzer overrode the result
    const finalAutoAccept = finalResult !== classification.initialScreenResult ? false : classification.autoAccept

    return {
      initialScreenResult: finalResult,
      expectedPositives,
      unexpectedPositives,
      unexpectedNegatives: [...unexpectedNegatives, ...criticalNegatives], // Combined for storage
      autoAccept: finalAutoAccept,
    }
  } catch (error) {
    payload.logger.error(
      `Failed to compute test results - Client: ${clientId}, Detected: ${JSON.stringify(detectedSubstances)}`,
      error,
    )
    throw error
  }
}

/**
 * Computes final status after confirmation testing is complete
 *
 * This determines pass/fail based on:
 * - Initial screen result (expected/unexpected positives/negatives)
 * - Confirmation results (confirmed-positive, confirmed-negative, inconclusive)
 * - Unexpected positives that were NOT sent for confirmation (client accepted the fail)
 * - Breathalyzer result (override if positive)
 *
 * @param params - Initial result, unexpected positives, confirmation results, breathalyzer data
 * @returns Final status classification
 */
export function computeFinalStatus(params: ComputeFinalStatusParams): FinalStatus {
  const {
    initialScreenResult,
    expectedPositives,
    unexpectedPositives,
    confirmationResults,
    breathalyzerTaken,
    breathalyzerResult,
  } = params

  // Count the types of confirmation results
  const confirmedPositiveCount = confirmationResults.filter((r) => r.result === 'confirmed-positive').length
  const inconclusiveCount = confirmationResults.filter((r) => r.result === 'inconclusive').length

  // Determine which unexpected positives were NOT sent for confirmation
  // These represent substances the client accepted as failures without confirmation
  const confirmedSubstances = new Set(confirmationResults.map((r) => r.substance.toLowerCase()))
  const unconfirmedUnexpectedPositives = unexpectedPositives.filter(
    (substance) => !confirmedSubstances.has(substance.toLowerCase()),
  )

  let finalStatus: FinalStatus

  // Determine final status based on what was confirmed
  if (inconclusiveCount > 0) {
    // If any confirmation came back inconclusive, overall result is inconclusive
    finalStatus = 'inconclusive'
  } else if (confirmedPositiveCount > 0) {
    // At least one substance confirmed positive = FAIL
    // Check if there are also unexpected negatives (from initial screen)
    if (
      initialScreenResult === 'mixed-unexpected' ||
      initialScreenResult === 'unexpected-negative-critical' ||
      initialScreenResult === 'unexpected-negative-warning'
    ) {
      finalStatus = 'mixed-unexpected'
    } else {
      finalStatus = 'unexpected-positive'
    }
  } else if (unconfirmedUnexpectedPositives.length > 0) {
    // All confirmations came back negative, BUT there are still unexpected positives
    // that were NOT sent for confirmation (client accepted the fail)
    // These are still failures
    if (
      initialScreenResult === 'mixed-unexpected' ||
      initialScreenResult === 'unexpected-negative-critical' ||
      initialScreenResult === 'unexpected-negative-warning'
    ) {
      finalStatus = 'mixed-unexpected'
    } else {
      finalStatus = 'unexpected-positive'
    }
  } else {
    // All confirmations came back negative AND no unconfirmed unexpected positives
    // The initial "unexpected positive" was a false alarm

    // Check if there were unexpected negatives from initial screen
    if (initialScreenResult === 'unexpected-negative-critical' || initialScreenResult === 'mixed-unexpected') {
      // Critical medications missing = still FAIL
      finalStatus = 'unexpected-negative-critical'
    } else if (initialScreenResult === 'unexpected-negative-warning') {
      // Only warning-level medications missing = WARNING (still technically compliant)
      finalStatus = 'unexpected-negative-warning'
    } else if (expectedPositives.length > 0) {
      // Had expected positives and confirmations ruled out false positives = PASS
      finalStatus = 'expected-positive'
    } else {
      // All negative, confirmations ruled out false positives = PASS
      finalStatus = 'confirmed-negative'
    }
  }

  // Apply breathalyzer override if positive
  return applyBreathalyzerOverride(finalStatus, breathalyzerTaken, breathalyzerResult)
}
