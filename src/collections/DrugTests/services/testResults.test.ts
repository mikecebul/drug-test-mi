import { describe, expect, test } from 'vitest'
import { computeFinalStatus } from './testResults'
import type { ComputeFinalStatusParams } from './testResults'

/**
 * Test suite for computeFinalStatus function
 *
 * This tests the logic for determining final test results after confirmation testing.
 * Critical edge case: Ensuring unexpected positives that were NOT sent for confirmation
 * (client accepted the fail) are still counted as failures.
 *
 * NOTE: This function does NOT determine what's "critical" or whether medications require
 * confirmation. That's determined upstream by computeTestResults() which has access to
 * medication data with requireConfirmation flags. This function just receives the
 * initialScreenResult classification and confirmation outcomes.
 */
describe('computeFinalStatus', () => {
  describe('Edge Case: Unexpected positives not sent for confirmation', () => {
    test('should return unexpected-positive when there are unconfirmed unexpected positives, even if confirmations came back negative', () => {
      /**
       * Scenario from bug report:
       * - 3 substances detected: Amphetamines (expected), THC (unexpected), Fentanyl (unexpected)
       * - THC was sent for confirmation → came back confirmed-negative (false positive)
       * - Fentanyl was NOT sent for confirmation (client accepted the fail)
       * - Amphetamines is expected positive (pass)
       *
       * Expected result: unexpected-positive (FAIL) because Fentanyl is still a failure
       */
      const params: ComputeFinalStatusParams = {
        initialScreenResult: 'unexpected-positive',
        expectedPositives: ['amphetamines'],
        unexpectedPositives: ['thc', 'fentanyl'], // Both were unexpected
        confirmationResults: [
          {
            substance: 'thc', // Only THC was confirmed
            result: 'confirmed-negative', // And it came back negative (false positive)
          },
        ],
        breathalyzerTaken: false,
        breathalyzerResult: null,
      }

      const result = computeFinalStatus(params)

      // Should still be a fail because Fentanyl was not confirmed (client accepted the fail)
      expect(result).toBe('unexpected-positive')
    })

    test('should return expected-positive when all unexpected positives were confirmed negative', () => {
      /**
       * Scenario:
       * - 3 substances detected: Amphetamines (expected), THC (unexpected), Cocaine (unexpected)
       * - Both THC and Cocaine were sent for confirmation → both came back confirmed-negative
       * - Amphetamines is expected positive (pass)
       *
       * Expected result: expected-positive (PASS) because all unexpected were false positives
       */
      const params: ComputeFinalStatusParams = {
        initialScreenResult: 'unexpected-positive',
        expectedPositives: ['amphetamines'],
        unexpectedPositives: ['thc', 'cocaine'],
        confirmationResults: [
          { substance: 'thc', result: 'confirmed-negative' },
          { substance: 'cocaine', result: 'confirmed-negative' },
        ],
        breathalyzerTaken: false,
        breathalyzerResult: null,
      }

      const result = computeFinalStatus(params)

      expect(result).toBe('expected-positive')
    })

    test('should return mixed-unexpected when initialScreenResult is mixed-unexpected AND there are unconfirmed unexpected positives', () => {
      /**
       * Scenario:
       * - initialScreenResult was already classified as 'mixed-unexpected' by computeTestResults()
       *   (meaning there were both unexpected positives AND unexpected negatives on initial screen)
       * - THC sent for confirmation → confirmed-negative (false positive)
       * - Fentanyl NOT sent for confirmation (client accepted fail)
       *
       * Expected result: mixed-unexpected (FAIL) - stays as mixed because there's still
       * an unconfirmed unexpected positive (Fentanyl)
       *
       * NOTE: Whether the unexpected negatives were "critical" (requireConfirmation=true)
       * was already determined by computeTestResults(). This function just receives
       * the classification.
       */
      const params: ComputeFinalStatusParams = {
        initialScreenResult: 'mixed-unexpected',
        expectedPositives: ['amphetamines'],
        unexpectedPositives: ['thc', 'fentanyl'],
        confirmationResults: [{ substance: 'thc', result: 'confirmed-negative' }],
        breathalyzerTaken: false,
        breathalyzerResult: null,
      }

      const result = computeFinalStatus(params)

      expect(result).toBe('mixed-unexpected')
    })
  })

  describe('Basic confirmation scenarios', () => {
    test('should return unexpected-positive when at least one confirmation is positive', () => {
      const params: ComputeFinalStatusParams = {
        initialScreenResult: 'unexpected-positive',
        expectedPositives: [],
        unexpectedPositives: ['thc', 'cocaine'],
        confirmationResults: [
          { substance: 'thc', result: 'confirmed-negative' },
          { substance: 'cocaine', result: 'confirmed-positive' },
        ],
        breathalyzerTaken: false,
        breathalyzerResult: null,
      }

      const result = computeFinalStatus(params)

      expect(result).toBe('unexpected-positive')
    })

    test('should return inconclusive when any confirmation is inconclusive', () => {
      const params: ComputeFinalStatusParams = {
        initialScreenResult: 'unexpected-positive',
        expectedPositives: [],
        unexpectedPositives: ['thc', 'cocaine'],
        confirmationResults: [
          { substance: 'thc', result: 'confirmed-negative' },
          { substance: 'cocaine', result: 'inconclusive' },
        ],
        breathalyzerTaken: false,
        breathalyzerResult: null,
      }

      const result = computeFinalStatus(params)

      expect(result).toBe('inconclusive')
    })

    test('should return confirmed-negative when all confirmations are negative with no expected positives', () => {
      const params: ComputeFinalStatusParams = {
        initialScreenResult: 'unexpected-positive',
        expectedPositives: [],
        unexpectedPositives: ['thc', 'cocaine'],
        confirmationResults: [
          { substance: 'thc', result: 'confirmed-negative' },
          { substance: 'cocaine', result: 'confirmed-negative' },
        ],
        breathalyzerTaken: false,
        breathalyzerResult: null,
      }

      const result = computeFinalStatus(params)

      expect(result).toBe('confirmed-negative')
    })
  })

  describe('Breathalyzer override', () => {
    test('should override to unexpected-positive when breathalyzer is positive', () => {
      const params: ComputeFinalStatusParams = {
        initialScreenResult: 'negative',
        expectedPositives: [],
        unexpectedPositives: [],
        confirmationResults: [],
        breathalyzerTaken: true,
        breathalyzerResult: 0.05, // Positive BAC
      }

      const result = computeFinalStatus(params)

      expect(result).toBe('unexpected-positive')
    })

    test('should not override when breathalyzer is zero', () => {
      const params: ComputeFinalStatusParams = {
        initialScreenResult: 'expected-positive',
        expectedPositives: ['amphetamines'],
        unexpectedPositives: [],
        confirmationResults: [],
        breathalyzerTaken: true,
        breathalyzerResult: 0.0,
      }

      const result = computeFinalStatus(params)

      expect(result).toBe('expected-positive')
    })
  })

  describe('Unexpected negatives (passthrough)', () => {
    test('should preserve unexpected-negative-critical classification from initialScreenResult', () => {
      /**
       * This tests that when initialScreenResult is 'unexpected-negative-critical',
       * and all confirmations came back negative (no confirmed positives),
       * the final status correctly preserves the critical failure.
       *
       * NOTE: The determination of what's "critical" (medications with requireConfirmation=true)
       * was already done by computeTestResults(). This function just preserves that classification.
       */
      const params: ComputeFinalStatusParams = {
        initialScreenResult: 'unexpected-negative-critical',
        expectedPositives: ['amphetamines'],
        unexpectedPositives: [],
        confirmationResults: [],
        breathalyzerTaken: false,
        breathalyzerResult: null,
      }

      const result = computeFinalStatus(params)

      expect(result).toBe('unexpected-negative-critical')
    })

    test('should preserve unexpected-negative-warning classification from initialScreenResult', () => {
      /**
       * This tests that when initialScreenResult is 'unexpected-negative-warning',
       * and all confirmations came back negative (no confirmed positives),
       * the final status correctly preserves the warning.
       *
       * NOTE: The determination of what's a "warning" (medications with requireConfirmation=false)
       * was already done by computeTestResults(). This function just preserves that classification.
       */
      const params: ComputeFinalStatusParams = {
        initialScreenResult: 'unexpected-negative-warning',
        expectedPositives: ['amphetamines'],
        unexpectedPositives: [],
        confirmationResults: [],
        breathalyzerTaken: false,
        breathalyzerResult: null,
      }

      const result = computeFinalStatus(params)

      expect(result).toBe('unexpected-negative-warning')
    })
  })
})
