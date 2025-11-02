/**
 * Drug test result classification logic
 *
 * Pure functions for determining test result classification based on
 * detected substances, expected substances, and criticality levels.
 */

export type TestClassification = {
  initialScreenResult:
    | 'negative'
    | 'expected-positive'
    | 'unexpected-positive'
    | 'unexpected-negative-critical'
    | 'unexpected-negative-warning'
    | 'mixed-unexpected'
  autoAccept: boolean
}

export type ClassificationInput = {
  detectedCount: number
  expectedCount: number
  unexpectedPositivesCount: number
  unexpectedNegativesCount: number
  criticalNegativesCount: number
}

/**
 * Classify a drug test result based on detected and expected substances
 *
 * Classification Logic:
 * - negative: All substances negative AND no medications with expected positives (AUTO-ACCEPT)
 * - expected-positive: All detected substances ARE in expected list (PASS - AUTO-ACCEPT)
 * - unexpected-positive: Has substances NOT in expected list (FAIL - REQUIRES DECISION)
 * - unexpected-negative-critical: Expected substances with requireConfirmation=true NOT detected (FAIL - Red Flag - REQUIRES DECISION)
 * - unexpected-negative-warning: Expected substances with requireConfirmation=false NOT detected (WARNING - AUTO-ACCEPT)
 * - mixed-unexpected: Both unexpected positives AND negatives (FAIL - REQUIRES DECISION)
 *
 * Note: "Inconclusive" results (leaked samples, contamination) are NOT part of this classification.
 * Those should be marked manually using the isInconclusive checkbox field.
 *
 * @param input - Object containing counts for detected, expected, and unexpected substances
 * @returns Object with classification result and auto-accept flag
 *
 * @example
 * // All negative test
 * classifyTestResult({
 *   detectedCount: 0,
 *   expectedCount: 0,
 *   unexpectedPositivesCount: 0,
 *   unexpectedNegativesCount: 0,
 *   criticalNegativesCount: 0
 * })
 * // => { initialScreenResult: 'negative', autoAccept: true }
 *
 * @example
 * // Unexpected positive
 * classifyTestResult({
 *   detectedCount: 1,
 *   expectedCount: 0,
 *   unexpectedPositivesCount: 1,
 *   unexpectedNegativesCount: 0,
 *   criticalNegativesCount: 0
 * })
 * // => { initialScreenResult: 'unexpected-positive', autoAccept: false }
 */
export function classifyTestResult(input: ClassificationInput): TestClassification {
  const {
    detectedCount,
    expectedCount,
    unexpectedPositivesCount,
    unexpectedNegativesCount,
    criticalNegativesCount,
  } = input

  // No substances detected, no medications expected = PASS
  if (detectedCount === 0 && expectedCount === 0) {
    return {
      initialScreenResult: 'negative',
      autoAccept: true,
    }
  }

  // Nothing detected but CRITICAL medications expected = FAIL (critical unexpected negatives)
  if (detectedCount === 0 && criticalNegativesCount > 0) {
    return {
      initialScreenResult: 'unexpected-negative-critical',
      autoAccept: false,
    }
  }

  // Nothing detected but non-critical medications expected = WARNING (soft unexpected negatives)
  if (detectedCount === 0 && unexpectedNegativesCount > 0) {
    return {
      initialScreenResult: 'unexpected-negative-warning',
      autoAccept: true, // Auto-accept warnings
    }
  }

  // Both unexpected positives AND negatives (critical or warning) = FAIL (mixed)
  if (
    unexpectedPositivesCount > 0 &&
    (criticalNegativesCount > 0 || unexpectedNegativesCount > 0)
  ) {
    return {
      initialScreenResult: 'mixed-unexpected',
      autoAccept: false,
    }
  }

  // Only unexpected positives = FAIL
  if (unexpectedPositivesCount > 0) {
    return {
      initialScreenResult: 'unexpected-positive',
      autoAccept: false,
    }
  }

  // Only critical unexpected negatives = FAIL (red flag)
  if (criticalNegativesCount > 0) {
    return {
      initialScreenResult: 'unexpected-negative-critical',
      autoAccept: false,
    }
  }

  // Only non-critical unexpected negatives = WARNING
  if (unexpectedNegativesCount > 0) {
    return {
      initialScreenResult: 'unexpected-negative-warning',
      autoAccept: true, // Auto-accept warnings
    }
  }

  // All detected substances are expected = PASS
  if (
    detectedCount > 0 &&
    unexpectedPositivesCount === 0 &&
    unexpectedNegativesCount === 0 &&
    criticalNegativesCount === 0
  ) {
    return {
      initialScreenResult: 'expected-positive',
      autoAccept: true,
    }
  }

  // This should never be reached - all cases should be covered above
  // If we get here, it indicates a logic error or unexpected edge case
  throw new Error(
    `Unhandled classification case: detected=${detectedCount}, expected=${expectedCount}, ` +
    `unexpectedPos=${unexpectedPositivesCount}, unexpectedNeg=${unexpectedNegativesCount}, ` +
    `criticalNeg=${criticalNegativesCount}`,
  )
}
