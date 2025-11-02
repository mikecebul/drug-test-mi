/**
 * Confirmation testing status utilities
 *
 * Helper functions for determining if confirmation testing workflow is complete.
 */

type ConfirmationResult = {
  substance: string
  result: string
  notes?: string
}

/**
 * Check if confirmation testing is complete
 *
 * Confirmation is considered complete when:
 * 1. Confirmation was requested
 * 2. Both confirmationResults and confirmationSubstances arrays exist and have items
 * 3. The number of results matches the number of substances requested
 * 4. Every result has both a substance and a result value
 *
 * @param confirmationDecision - Whether confirmation was requested ('request-confirmation' or 'accept')
 * @param confirmationSubstances - Array of substances that were sent for confirmation
 * @param confirmationResults - Array of confirmation test results
 * @returns true if confirmation testing is complete, false otherwise
 *
 * @example
 * isConfirmationComplete(
 *   'request-confirmation',
 *   ['thc', 'cocaine'],
 *   [{ substance: 'thc', result: 'confirmed-negative' }, { substance: 'cocaine', result: 'confirmed-positive' }]
 * ) // true
 *
 * @example
 * isConfirmationComplete('accept', [], []) // false (no confirmation requested)
 *
 * @example
 * isConfirmationComplete('request-confirmation', ['thc'], []) // false (no results yet)
 */
export function isConfirmationComplete(
  confirmationDecision: string | undefined,
  confirmationSubstances: string[] | undefined,
  confirmationResults: ConfirmationResult[] | undefined,
): boolean {
  const hadConfirmation = confirmationDecision === 'request-confirmation'

  if (!hadConfirmation) return false

  const substances = Array.isArray(confirmationSubstances) ? confirmationSubstances : []
  const results = Array.isArray(confirmationResults) ? confirmationResults : []

  if (results.length === 0 || substances.length === 0) return false

  if (results.length !== substances.length) return false

  return results.every((result) => result.result && result.substance)
}
