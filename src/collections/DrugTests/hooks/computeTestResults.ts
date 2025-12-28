import type { CollectionBeforeChangeHook } from 'payload'
import { isConfirmationComplete } from '../helpers/confirmationStatus'
import { computeTestResults as computeTestResultsService, computeFinalStatus } from '../services'

/**
 * Business Logic Hook: Computes test result classification
 *
 * This hook runs before a drug test is saved and:
 * 1. Computes test result classification using service layer (see services/testResults.ts)
 * 2. Populates: expectedPositives, unexpectedPositives, unexpectedNegatives, initialScreenResult
 * 3. Determines final status after confirmation testing (if complete)
 * 4. Auto-accepts results for negative and expected-positive scenarios
 * 5. Auto-completes when criteria are met
 *
 * Test result computation is handled by computeTestResults() service which:
 * - Fetches client's active medications at test time
 * - Compares detected substances with expected substances from medications
 * - Classifies results and applies breathalyzer override if positive
 *
 * Classification Logic:
 * - negative: All substances negative AND no medications with expected positives (AUTO-ACCEPT)
 * - expected-positive: All detected substances ARE in expected list (PASS - AUTO-ACCEPT)
 * - unexpected-positive: Has substances NOT in expected list (FAIL - REQUIRES DECISION)
 * - unexpected-negative-critical: Expected substances with requireConfirmation=true NOT detected (FAIL - Red Flag - REQUIRES DECISION)
 * - unexpected-negative-warning: Expected substances with requireConfirmation=false NOT detected (WARNING - AUTO-ACCEPT)
 * - mixed-unexpected: Both unexpected positives AND negatives (FAIL - REQUIRES DECISION)
 * - inconclusive: Unable to determine
 */
export const computeTestResults: CollectionBeforeChangeHook = async ({ data, req }) => {
  if (!data) return data

  // Handle inconclusive tests FIRST - skip all other computation
  // Inconclusive means the sample was invalid (leaked, damaged, or unable to screen)
  if (data.isInconclusive) {
    data.screeningStatus = 'complete'
    data.isComplete = true
    data.initialScreenResult = undefined // Clear any computed result
    data.finalStatus = 'inconclusive'
    return data
  }

  const { detectedSubstances, relatedClient, screeningStatus, testDocument } = data

  // Auto-upgrade screeningStatus to 'screened' when test document is uploaded
  if (testDocument && screeningStatus === 'collected') {
    data.screeningStatus = 'screened'
  }

  // Auto-upgrade existing records without screeningStatus
  const currentStatus =
    data.screeningStatus || (data.initialScreenResult ? 'screened' : 'collected')

  // For collected tests (not yet screened), set isComplete = false so they appear in tracker
  // Collected tests need to be tracked for screening
  // Allow processing for screened, confirmation-pending, and complete statuses
  if (currentStatus === 'collected') {
    data.isComplete = false
    return data
  }

  // Default to empty array if not set (handles both undefined and null)
  const detected = detectedSubstances && Array.isArray(detectedSubstances) ? detectedSubstances : []

  // Skip if no relatedClient (required field will be validated separately)
  if (!relatedClient) {
    return data
  }

  try {
    // Compute test results using service layer
    // Uses medicationsArrayAtTestTime snapshot instead of current medications
    // This ensures test results are based on medications at time of test, not current state
    const result = await computeTestResultsService({
      clientId: relatedClient as string,
      detectedSubstances: detected,
      medicationsAtTestTime: (data.medicationsArrayAtTestTime as any) || [],
      testType: data.testType as any, // Filter expected substances by what this test type screens for
      breathalyzerTaken: data.breathalyzerTaken,
      breathalyzerResult: data.breathalyzerResult,
      payload: req.payload,
    })

    // Update the data object with computed values
    data.expectedPositives = result.expectedPositives
    data.unexpectedPositives = result.unexpectedPositives
    data.unexpectedNegatives = result.unexpectedNegatives
    data.initialScreenResult = result.initialScreenResult

    // Extract values for auto-accept logic
    const { initialScreenResult, autoAccept } = result

    // Auto-accept for negative and expected-positive results (if not already set)
    // Note: This will not trigger if breathalyzer overrode the result above
    if (autoAccept && !data.confirmationDecision) {
      data.confirmationDecision = 'accept'
    }

    // Compute finalStatus if confirmation testing is complete
    const confirmationComplete = isConfirmationComplete(
      data.confirmationDecision,
      data.confirmationSubstances,
      data.confirmationResults,
    )

    if (confirmationComplete) {
      // Compute final status using service layer
      // This should NOT depend on current medications (which may have changed)
      // It should only depend on: initial screen result + confirmation outcomes
      data.finalStatus = computeFinalStatus({
        initialScreenResult,
        expectedPositives: result.expectedPositives,
        unexpectedPositives: result.unexpectedPositives,
        confirmationResults: data.confirmationResults || [],
        breathalyzerTaken: data.breathalyzerTaken,
        breathalyzerResult: data.breathalyzerResult,
      })
    }

    // Auto-update screeningStatus based on confirmation workflow
    if (confirmationComplete) {
      data.screeningStatus = 'complete'
    } else if (data.confirmationDecision === 'request-confirmation') {
      data.screeningStatus = 'confirmation-pending'
    }

    // Auto-complete logic
    // Complete if:
    // 1. Auto-accepted (negative or expected-positive)
    // 2. Manually accepted
    // 3. Confirmation requested and ALL results received
    if (autoAccept || data.confirmationDecision === 'accept') {
      data.isComplete = true
    } else if (confirmationComplete) {
      data.isComplete = true
    } else {
      data.isComplete = false
    }

    return data
  } catch (error) {
    req.payload.logger.error(
      `Failed to compute test results for drug test - Client: ${relatedClient}, Detected: ${JSON.stringify(detectedSubstances)}`,
      error,
    )

    // Set safe fallback values
    data.initialScreenResult = 'inconclusive'
    data.processNotes =
      (data.processNotes || '') +
      `\n\n[ERROR] Automated test result computation failed. Manual review required.`

    return data
  }
}
