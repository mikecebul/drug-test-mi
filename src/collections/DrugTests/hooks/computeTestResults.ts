import type { FieldHook } from 'payload'

/**
 * Business Logic Hook: Computes test result classification
 *
 * This hook runs before a drug test is saved and:
 * 1. Fetches client's active medications at test time
 * 2. Extracts expected substances from medication detectedAs fields
 * 3. Compares detected substances with expected substances
 * 4. Populates: expectedPositives, unexpectedPositives, unexpectedNegatives
 * 5. Determines overall initialScreenResult classification
 *
 * Classification Logic:
 * - negative: All substances negative AND no medications with expected positives
 * - expected-positive: All detected substances ARE in expected list (PASS)
 * - unexpected-positive: Has substances NOT in expected list (FAIL)
 * - unexpected-negative: Expected substances NOT detected (FAIL - Red Flag)
 * - mixed-unexpected: Both unexpected positives AND negatives (FAIL)
 * - inconclusive: Unable to determine
 */
export const computeTestResults: FieldHook = async ({ data, req, operation, value }) => {
  // Only run on create or when detectedSubstances changes
  if (!data) return value

  const { detectedSubstances, relatedClient } = data

  // If no detected substances, nothing to compute yet
  if (!detectedSubstances || !Array.isArray(detectedSubstances)) {
    return value
  }

  try {
    // Fetch client with medications
    const client = await req.payload.findByID({
      collection: 'clients',
      id: relatedClient as string,
      depth: 0,
    })

    if (!client || !client.medications) {
      console.warn('No client or medications found for drug test')
      return value
    }

    // Extract expected substances from active medications
    const expectedSubstances = new Set<string>()

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

    // Convert to arrays for comparison
    const detected = new Set(detectedSubstances)
    const expected = expectedSubstances

    // Compute result arrays
    const expectedPositives: string[] = []
    const unexpectedPositives: string[] = []
    const unexpectedNegatives: string[] = []

    // Check detected substances
    detected.forEach(substance => {
      if (expected.has(substance)) {
        expectedPositives.push(substance)
      } else {
        unexpectedPositives.push(substance)
      }
    })

    // Check for missing expected substances
    expected.forEach(substance => {
      if (!detected.has(substance)) {
        unexpectedNegatives.push(substance)
      }
    })

    // Determine overall result classification
    let initialScreenResult: string

    if (detected.size === 0 && expected.size === 0) {
      // No substances detected, no medications expected = PASS
      initialScreenResult = 'negative'
    } else if (detected.size === 0 && expected.size > 0) {
      // Nothing detected but medications expected = FAIL (unexpected negatives)
      initialScreenResult = 'unexpected-negative'
    } else if (unexpectedPositives.length > 0 && unexpectedNegatives.length > 0) {
      // Both types of unexpected results = FAIL (mixed)
      initialScreenResult = 'mixed-unexpected'
    } else if (unexpectedPositives.length > 0) {
      // Only unexpected positives = FAIL
      initialScreenResult = 'unexpected-positive'
    } else if (unexpectedNegatives.length > 0) {
      // Only unexpected negatives = FAIL (red flag)
      initialScreenResult = 'unexpected-negative'
    } else if (detected.size > 0 && unexpectedPositives.length === 0 && unexpectedNegatives.length === 0) {
      // All detected substances are expected = PASS
      initialScreenResult = 'expected-positive'
    } else {
      // Fallback
      initialScreenResult = 'inconclusive'
    }

    // Update the data object with computed values
    data.expectedPositives = expectedPositives
    data.unexpectedPositives = unexpectedPositives
    data.unexpectedNegatives = unexpectedNegatives
    data.initialScreenResult = initialScreenResult

    return value
  } catch (error) {
    console.error('Error computing test results:', error)
    return value
  }
}
