/**
 * Tests for classifyTestResult helper
 *
 * Pure function tests for drug test classification logic
 */

import { describe, test, expect } from 'vitest'
import { classifyTestResult } from '../classifyTestResult'

describe('classifyTestResult', () => {
  describe('PASS - Negative scenarios', () => {
    test('All negative, no medications', () => {
      const result = classifyTestResult({
        detectedCount: 0,
        expectedCount: 0,
        unexpectedPositivesCount: 0,
        unexpectedNegativesCount: 0,
        criticalNegativesCount: 0,
      })

      expect(result).toEqual({
        initialScreenResult: 'negative',
        autoAccept: true,
      })
    })
  })

  describe('PASS - Expected Positive scenarios', () => {
    test('All detected substances are expected', () => {
      const result = classifyTestResult({
        detectedCount: 2,
        expectedCount: 2,
        unexpectedPositivesCount: 0,
        unexpectedNegativesCount: 0,
        criticalNegativesCount: 0,
      })

      expect(result).toEqual({
        initialScreenResult: 'expected-positive',
        autoAccept: true,
      })
    })
  })

  describe('FAIL - Unexpected Positive scenarios', () => {
    test('Substance detected that is not expected', () => {
      const result = classifyTestResult({
        detectedCount: 1,
        expectedCount: 0,
        unexpectedPositivesCount: 1,
        unexpectedNegativesCount: 0,
        criticalNegativesCount: 0,
      })

      expect(result).toEqual({
        initialScreenResult: 'unexpected-positive',
        autoAccept: false,
      })
    })

    test('Mix of expected and unexpected positives', () => {
      const result = classifyTestResult({
        detectedCount: 2,
        expectedCount: 1,
        unexpectedPositivesCount: 1,
        unexpectedNegativesCount: 0,
        criticalNegativesCount: 0,
      })

      expect(result).toEqual({
        initialScreenResult: 'unexpected-positive',
        autoAccept: false,
      })
    })
  })

  describe('FAIL - Critical Unexpected Negative scenarios', () => {
    test('Critical medication not detected (requireConfirmation=true)', () => {
      const result = classifyTestResult({
        detectedCount: 0,
        expectedCount: 1,
        unexpectedPositivesCount: 0,
        unexpectedNegativesCount: 0,
        criticalNegativesCount: 1,
      })

      expect(result).toEqual({
        initialScreenResult: 'unexpected-negative-critical',
        autoAccept: false,
      })
    })

    test('Only critical negatives remain after some detections', () => {
      const result = classifyTestResult({
        detectedCount: 1,
        expectedCount: 2,
        unexpectedPositivesCount: 0,
        unexpectedNegativesCount: 0,
        criticalNegativesCount: 1,
      })

      expect(result).toEqual({
        initialScreenResult: 'unexpected-negative-critical',
        autoAccept: false,
      })
    })
  })

  describe('WARNING - Non-Critical Unexpected Negative scenarios', () => {
    test('Non-critical medication not detected (requireConfirmation=false)', () => {
      const result = classifyTestResult({
        detectedCount: 0,
        expectedCount: 1,
        unexpectedPositivesCount: 0,
        unexpectedNegativesCount: 1,
        criticalNegativesCount: 0,
      })

      expect(result).toEqual({
        initialScreenResult: 'unexpected-negative-warning',
        autoAccept: true, // Auto-accept warnings
      })
    })

    test('Only warning-level negatives after some detections', () => {
      const result = classifyTestResult({
        detectedCount: 1,
        expectedCount: 2,
        unexpectedPositivesCount: 0,
        unexpectedNegativesCount: 1,
        criticalNegativesCount: 0,
      })

      expect(result).toEqual({
        initialScreenResult: 'unexpected-negative-warning',
        autoAccept: true,
      })
    })
  })

  describe('FAIL - Mixed Unexpected scenarios', () => {
    test('Both unexpected positive and critical negative', () => {
      const result = classifyTestResult({
        detectedCount: 1,
        expectedCount: 1,
        unexpectedPositivesCount: 1,
        unexpectedNegativesCount: 0,
        criticalNegativesCount: 1,
      })

      expect(result).toEqual({
        initialScreenResult: 'mixed-unexpected',
        autoAccept: false,
      })
    })

    test('Both unexpected positive and warning-level negative', () => {
      const result = classifyTestResult({
        detectedCount: 1,
        expectedCount: 1,
        unexpectedPositivesCount: 1,
        unexpectedNegativesCount: 1,
        criticalNegativesCount: 0,
      })

      expect(result).toEqual({
        initialScreenResult: 'mixed-unexpected',
        autoAccept: false,
      })
    })

    test('Unexpected positive with both critical and warning negatives', () => {
      const result = classifyTestResult({
        detectedCount: 1,
        expectedCount: 2,
        unexpectedPositivesCount: 1,
        unexpectedNegativesCount: 1,
        criticalNegativesCount: 1,
      })

      expect(result).toEqual({
        initialScreenResult: 'mixed-unexpected',
        autoAccept: false,
      })
    })
  })


  describe('Priority order tests', () => {
    test('Critical negatives take priority over warning negatives when nothing detected', () => {
      const result = classifyTestResult({
        detectedCount: 0,
        expectedCount: 3,
        unexpectedPositivesCount: 0,
        unexpectedNegativesCount: 1,
        criticalNegativesCount: 1,
      })

      // Should classify as critical, not warning
      expect(result.initialScreenResult).toBe('unexpected-negative-critical')
      expect(result.autoAccept).toBe(false)
    })

    test('Unexpected positives with negatives result in mixed, not just unexpected-positive', () => {
      const result = classifyTestResult({
        detectedCount: 2,
        expectedCount: 2,
        unexpectedPositivesCount: 1,
        unexpectedNegativesCount: 1,
        criticalNegativesCount: 0,
      })

      expect(result.initialScreenResult).toBe('mixed-unexpected')
    })
  })
})
