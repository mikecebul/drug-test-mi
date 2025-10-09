import type { CollectionBeforeChangeHook } from 'payload'

/**
 * Business Logic Hook: Computes test result classification
 *
 * This hook runs before a drug test is saved and:
 * 1. Fetches client's active medications at test time
 * 2. Extracts expected substances from medication detectedAs fields
 * 3. Compares detected substances with expected substances
 * 4. Populates: expectedPositives, unexpectedPositives, unexpectedNegatives
 * 5. Determines overall initialScreenResult classification
 * 6. Auto-accepts results for negative and expected-positive scenarios
 * 7. Auto-completes when criteria are met
 *
 * Classification Logic:
 * - negative: All substances negative AND no medications with expected positives (AUTO-ACCEPT)
 * - expected-positive: All detected substances ARE in expected list (PASS - AUTO-ACCEPT)
 * - unexpected-positive: Has substances NOT in expected list (FAIL - REQUIRES DECISION)
 * - unexpected-negative: Expected substances NOT detected (FAIL - Red Flag - REQUIRES DECISION)
 * - mixed-unexpected: Both unexpected positives AND negatives (FAIL - REQUIRES DECISION)
 * - inconclusive: Unable to determine
 */
export const computeTestResults: CollectionBeforeChangeHook = async ({ data, req, operation }) => {
  if (!data) return data

  const { detectedSubstances, relatedClient, screeningStatus } = data

  // Auto-upgrade existing records without screeningStatus
  const currentStatus = screeningStatus || (data.initialScreenResult ? 'screened' : 'collected')

  // Only compute results if screening is complete
  // This prevents setting results for lab tests that haven't been screened yet
  if (currentStatus !== 'screened') {
    return data
  }

  // Default to empty array if not set (handles both undefined and null)
  const detected = detectedSubstances && Array.isArray(detectedSubstances) ? detectedSubstances : []

  // Skip if no relatedClient (required field will be validated separately)
  if (!relatedClient) {
    return data
  }

  try {
    // Fetch client with medications
    const client = await req.payload.findByID({
      collection: 'clients',
      id: relatedClient as string,
      depth: 0,
    })

    if (!client) {
      console.warn('Client not found for drug test')
      return data
    }

    // Extract expected substances from active medications
    const expectedSubstances = new Set<string>()

    if (client.medications && Array.isArray(client.medications)) {
      client.medications
        .filter((med: any) => med.status === 'active')
        .forEach((med: any) => {
          if (med.detectedAs && Array.isArray(med.detectedAs)) {
            med.detectedAs.forEach((substance: string) => {
              if (substance !== 'none') {
                expectedSubstances.add(substance)
              }
            })
          }
        })
    }

    // Convert to sets for comparison
    const detectedSet = new Set(detected)
    const expectedSet = expectedSubstances

    // Compute result arrays
    const expectedPositives: string[] = []
    const unexpectedPositives: string[] = []
    const unexpectedNegatives: string[] = []

    // Check detected substances
    detectedSet.forEach(substance => {
      if (expectedSet.has(substance)) {
        expectedPositives.push(substance)
      } else {
        unexpectedPositives.push(substance)
      }
    })

    // Check for missing expected substances
    expectedSet.forEach(substance => {
      if (!detectedSet.has(substance)) {
        unexpectedNegatives.push(substance)
      }
    })

    // Determine overall result classification
    let initialScreenResult: string
    let autoAccept = false

    if (detectedSet.size === 0 && expectedSet.size === 0) {
      // No substances detected, no medications expected = PASS
      initialScreenResult = 'negative'
      autoAccept = true
    } else if (detectedSet.size === 0 && expectedSet.size > 0) {
      // Nothing detected but medications expected = FAIL (unexpected negatives)
      initialScreenResult = 'unexpected-negative'
      autoAccept = false
    } else if (unexpectedPositives.length > 0 && unexpectedNegatives.length > 0) {
      // Both types of unexpected results = FAIL (mixed)
      initialScreenResult = 'mixed-unexpected'
      autoAccept = false
    } else if (unexpectedPositives.length > 0) {
      // Only unexpected positives = FAIL
      initialScreenResult = 'unexpected-positive'
      autoAccept = false
    } else if (unexpectedNegatives.length > 0) {
      // Only unexpected negatives = FAIL (red flag)
      initialScreenResult = 'unexpected-negative'
      autoAccept = false
    } else if (detectedSet.size > 0 && unexpectedPositives.length === 0 && unexpectedNegatives.length === 0) {
      // All detected substances are expected = PASS
      initialScreenResult = 'expected-positive'
      autoAccept = true
    } else {
      // Fallback
      initialScreenResult = 'inconclusive'
      autoAccept = true
    }

    // Update the data object with computed values
    data.expectedPositives = expectedPositives
    data.unexpectedPositives = unexpectedPositives
    data.unexpectedNegatives = unexpectedNegatives
    data.initialScreenResult = initialScreenResult

    // Auto-accept for negative and expected-positive results (if not already set)
    if (autoAccept && !data.confirmationDecision) {
      data.confirmationDecision = 'accept'
    }

    // Auto-complete logic
    // Complete if:
    // 1. Auto-accepted (negative or expected-positive)
    // 2. Manually accepted
    // 3. Confirmation requested and ALL results received
    if (autoAccept || data.confirmationDecision === 'accept') {
      data.isComplete = true
    } else if (
      data.confirmationDecision === 'request-confirmation' &&
      Array.isArray(data.confirmationResults) &&
      Array.isArray(data.confirmationSubstances) &&
      data.confirmationResults.length === data.confirmationSubstances.length &&
      data.confirmationResults.length > 0 &&
      data.confirmationResults.every((result: any) => result.result)
    ) {
      data.isComplete = true
    } else {
      data.isComplete = false
    }

    return data
  } catch (error) {
    console.error('Error computing test results:', error)
    return data
  }
}
