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

  const { detectedSubstances, relatedClient, screeningStatus, testDocument } = data

  // Auto-upgrade screeningStatus to 'screened' when test document is uploaded
  if (testDocument && screeningStatus === 'collected') {
    data.screeningStatus = 'screened'
  }

  // Auto-upgrade existing records without screeningStatus
  const currentStatus = data.screeningStatus || (data.initialScreenResult ? 'screened' : 'collected')

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

    // Compute finalStatus if confirmation testing is complete
    const hadConfirmation = data.confirmationDecision === 'request-confirmation'
    const confirmationSubstances = Array.isArray(data.confirmationSubstances)
      ? data.confirmationSubstances
      : []
    const confirmationResults = Array.isArray(data.confirmationResults) ? data.confirmationResults : []

    const confirmationComplete =
      hadConfirmation &&
      confirmationResults.length > 0 &&
      confirmationSubstances.length > 0 &&
      confirmationResults.length === confirmationSubstances.length &&
      confirmationResults.every((result: any) => result.result && result.substance)

    if (confirmationComplete) {
      // Check if any confirmation came back positive
      const hasConfirmedPositive = data.confirmationResults!.some(
        (result: any) => result.result === 'confirmed-positive',
      )

      // Check if initial screen had unexpected positives
      const hadUnexpectedPositives = initialScreenResult === 'unexpected-positive' || initialScreenResult === 'mixed-unexpected'

      if (hasConfirmedPositive) {
        // If any unexpected positive was confirmed, it's still a fail
        if (unexpectedNegatives.length > 0) {
          data.finalStatus = 'mixed-unexpected'
        } else {
          data.finalStatus = 'unexpected-positive'
        }
      } else {
        // All confirmations came back negative (false positives ruled out)
        if (hadUnexpectedPositives && unexpectedNegatives.length === 0) {
          // Initial screen showed unexpected positives, but confirmations ruled them out = PASS
          if (expectedPositives.length > 0) {
            data.finalStatus = 'expected-positive'
          } else {
            data.finalStatus = 'confirmed-negative'
          }
        } else if (unexpectedNegatives.length > 0) {
          // Only unexpected negatives remain (yellow warning)
          data.finalStatus = 'unexpected-negative'
        } else if (expectedPositives.length > 0) {
          // Nothing unexpected - expected positives only
          data.finalStatus = 'expected-positive'
        } else {
          // Nothing detected at all
          data.finalStatus = 'negative'
        }
      }
    }

    // Auto-update screeningStatus based on confirmation workflow
    if (confirmationComplete) {
      data.screeningStatus = 'complete'
    } else if (hadConfirmation) {
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
    console.error('Error computing test results:', error)
    return data
  }
}
