/**
 * Tests for isConfirmationComplete helper
 *
 * Tests the logic for determining if confirmation testing workflow is complete
 */

import { describe, test, expect } from 'vitest'
import { isConfirmationComplete } from '../confirmationStatus'

describe('isConfirmationComplete', () => {
  describe('Confirmation complete scenarios', () => {
    test('Confirmation requested with matching results', () => {
      const result = isConfirmationComplete(
        'request-confirmation',
        ['thc', 'cocaine'],
        [
          { substance: 'thc', result: 'confirmed-positive' },
          { substance: 'cocaine', result: 'confirmed-negative' },
        ],
      )

      expect(result).toBe(true)
    })

    test('Single substance confirmation complete', () => {
      const result = isConfirmationComplete(
        'request-confirmation',
        ['thc'],
        [{ substance: 'thc', result: 'confirmed-positive' }],
      )

      expect(result).toBe(true)
    })

    test('Multiple substances all confirmed', () => {
      const result = isConfirmationComplete(
        'request-confirmation',
        ['thc', 'cocaine', 'opiates'],
        [
          { substance: 'thc', result: 'confirmed-positive' },
          { substance: 'cocaine', result: 'confirmed-negative' },
          { substance: 'opiates', result: 'inconclusive' },
        ],
      )

      expect(result).toBe(true)
    })
  })

  describe('Confirmation incomplete scenarios', () => {
    test('Confirmation not requested (accept decision)', () => {
      const result = isConfirmationComplete(
        'accept',
        [],
        [],
      )

      expect(result).toBe(false)
    })

    test('Confirmation requested but no results yet', () => {
      const result = isConfirmationComplete(
        'request-confirmation',
        ['thc', 'cocaine'],
        [],
      )

      expect(result).toBe(false)
    })

    test('Confirmation requested but substances array empty', () => {
      const result = isConfirmationComplete(
        'request-confirmation',
        [],
        [{ substance: 'thc', result: 'confirmed-positive' }],
      )

      expect(result).toBe(false)
    })

    test('Mismatch: fewer results than substances', () => {
      const result = isConfirmationComplete(
        'request-confirmation',
        ['thc', 'cocaine', 'opiates'],
        [
          { substance: 'thc', result: 'confirmed-positive' },
          { substance: 'cocaine', result: 'confirmed-negative' },
        ],
      )

      expect(result).toBe(false)
    })

    test('Mismatch: more results than substances', () => {
      const result = isConfirmationComplete(
        'request-confirmation',
        ['thc'],
        [
          { substance: 'thc', result: 'confirmed-positive' },
          { substance: 'cocaine', result: 'confirmed-negative' },
        ],
      )

      expect(result).toBe(false)
    })

    test('Result missing substance field', () => {
      const result = isConfirmationComplete(
        'request-confirmation',
        ['thc'],
        [{ substance: '', result: 'confirmed-positive' }],
      )

      expect(result).toBe(false)
    })

    test('Result missing result field', () => {
      const result = isConfirmationComplete(
        'request-confirmation',
        ['thc'],
        [{ substance: 'thc', result: '' }],
      )

      expect(result).toBe(false)
    })
  })

  describe('Edge cases and undefined handling', () => {
    test('Undefined confirmationDecision', () => {
      const result = isConfirmationComplete(
        undefined,
        ['thc'],
        [{ substance: 'thc', result: 'confirmed-positive' }],
      )

      expect(result).toBe(false)
    })

    test('Undefined substances array', () => {
      const result = isConfirmationComplete(
        'request-confirmation',
        undefined,
        [{ substance: 'thc', result: 'confirmed-positive' }],
      )

      expect(result).toBe(false)
    })

    test('Undefined results array', () => {
      const result = isConfirmationComplete(
        'request-confirmation',
        ['thc'],
        undefined,
      )

      expect(result).toBe(false)
    })

    test('All undefined', () => {
      const result = isConfirmationComplete(
        undefined,
        undefined,
        undefined,
      )

      expect(result).toBe(false)
    })

    test('Empty decision string', () => {
      const result = isConfirmationComplete(
        '',
        ['thc'],
        [{ substance: 'thc', result: 'confirmed-positive' }],
      )

      expect(result).toBe(false)
    })
  })
})
