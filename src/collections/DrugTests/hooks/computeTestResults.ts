import type { CollectionBeforeChangeHook } from 'payload'
import { classifyTestResult } from '../helpers/classifyTestResult'
import { isConfirmationComplete } from '../helpers/confirmationStatus'

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
 * - unexpected-negative-critical: Expected substances with requireConfirmation=true NOT detected (FAIL - Red Flag - REQUIRES DECISION)
 * - unexpected-negative-warning: Expected substances with requireConfirmation=false NOT detected (WARNING - AUTO-ACCEPT)
 * - mixed-unexpected: Both unexpected positives AND negatives (FAIL - REQUIRES DECISION)
 * - inconclusive: Unable to determine
 */
export const computeTestResults: CollectionBeforeChangeHook = async ({ data, req, operation }) => {
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

    // Extract expected substances from active medications using flatMap
    // Track which substances require confirmation if missing
    const expectedSubstances = new Set<string>()
    const criticalSubstances = new Set<string>() // Substances that MUST show (requireConfirmation = true)

    if (client.medications && Array.isArray(client.medications)) {
      const activeMedications = client.medications.filter((med: any) => med.status === 'active')

      activeMedications.forEach((med: any) => {
        const substances = (med.detectedAs || []).filter((s: string) => s !== 'none')

        substances.forEach((substance: string) => {
          expectedSubstances.add(substance)
          if (med.requireConfirmation === true) {
            criticalSubstances.add(substance)
          }
        })
      })
    }

    // Convert to sets for comparison
    const detectedSet = new Set(detected)
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

    const { initialScreenResult, autoAccept } = classification

    // Update the data object with computed values
    data.expectedPositives = expectedPositives
    data.unexpectedPositives = unexpectedPositives
    data.unexpectedNegatives = [...unexpectedNegatives, ...criticalNegatives] // Combined for storage
    data.initialScreenResult = initialScreenResult

    // Auto-accept for negative and expected-positive results (if not already set)
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
      // Check if any confirmation came back positive
      const hasConfirmedPositive =
        data.confirmationResults?.some((result: any) => result.result === 'confirmed-positive') ??
        false

      // Check if initial screen had unexpected positives
      const hadUnexpectedPositives =
        initialScreenResult === 'unexpected-positive' || initialScreenResult === 'mixed-unexpected'

      if (hasConfirmedPositive) {
        // If any unexpected positive was confirmed, it's still a fail
        if (unexpectedNegatives.length > 0) {
          data.finalStatus = 'mixed-unexpected'
        } else {
          data.finalStatus = 'unexpected-positive'
        }
      } else {
        // All confirmations came back negative (false positives ruled out)
        if (
          hadUnexpectedPositives &&
          unexpectedNegatives.length === 0 &&
          criticalNegatives.length === 0
        ) {
          // Initial screen showed unexpected positives, but confirmations ruled them out = PASS
          if (expectedPositives.length > 0) {
            data.finalStatus = 'expected-positive'
          } else {
            data.finalStatus = 'confirmed-negative'
          }
        } else if (criticalNegatives.length > 0) {
          // Critical unexpected negatives remain
          data.finalStatus = 'unexpected-negative-critical'
        } else if (unexpectedNegatives.length > 0) {
          // Only non-critical unexpected negatives remain (warning)
          data.finalStatus = 'unexpected-negative-warning'
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
