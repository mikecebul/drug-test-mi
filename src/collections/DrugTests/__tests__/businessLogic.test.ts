/**
 * Drug Test Business Logic Unit Tests
 *
 * Tests the core business logic for classifying drug test results
 * based on detected substances vs. expected medications.
 */

import { describe, test, expect } from 'vitest'
import { computeTestResults } from '../hooks/computeTestResults'

// Mock Payload
const createMockPayload = (medications: any[]) => ({
  findByID: async () => ({
    id: 'test-client',
    medications,
  }),
})

// Mock request object
const createMockReq = (medications: any[]) => ({
  payload: createMockPayload(medications),
})

describe('Drug Test Business Logic', () => {
  describe('PASS Scenarios', () => {
    test('Scenario 1: Negative - All negative, no medications', async () => {
      const data: any = {
        detectedSubstances: [],
        relatedClient: 'client-1',
      }

      const req = createMockReq([])

      await computeTestResults({
        data,
        req: req as any,
        operation: 'create',
        value: undefined,
      } as any)

      expect(data.expectedPositives).toEqual([])
      expect(data.unexpectedPositives).toEqual([])
      expect(data.unexpectedNegatives).toEqual([])
      expect(data.initialScreenResult).toBe('negative')
    })

    test('Scenario 2: Expected Positive - Client on Oxycodone, test shows Oxycodone', async () => {
      const medications = [
        {
          medicationName: 'Oxycodone',
          status: 'active',
          detectedAs: ['oxycodone'],
        },
      ]

      const data: any = {
        detectedSubstances: ['oxycodone'],
        relatedClient: 'client-1',
      }

      const req = createMockReq(medications)

      await computeTestResults({
        data,
        req: req as any,
        operation: 'create',
        value: undefined,
      } as any)

      expect(data.expectedPositives).toEqual(['oxycodone'])
      expect(data.unexpectedPositives).toEqual([])
      expect(data.unexpectedNegatives).toEqual([])
      expect(data.initialScreenResult).toBe('expected-positive')
    })

    test('Scenario 3: Expected Positive - Multiple medications all showing correctly', async () => {
      const medications = [
        {
          medicationName: 'Oxycodone',
          status: 'active',
          detectedAs: ['oxycodone'],
        },
        {
          medicationName: 'Xanax',
          status: 'active',
          detectedAs: ['benzodiazepines'],
        },
      ]

      const data: any = {
        detectedSubstances: ['oxycodone', 'benzodiazepines'],
        relatedClient: 'client-1',
      }

      const req = createMockReq(medications)

      await computeTestResults({
        data,
        req: req as any,
        operation: 'create',
        value: undefined,
      } as any)

      expect(data.expectedPositives).toEqual(['oxycodone', 'benzodiazepines'])
      expect(data.unexpectedPositives).toEqual([])
      expect(data.unexpectedNegatives).toEqual([])
      expect(data.initialScreenResult).toBe('expected-positive')
    })
  })

  describe('FAIL Scenarios', () => {
    test('Scenario 1: Unexpected Positive - THC detected, no THC medication', async () => {
      const data: any = {
        detectedSubstances: ['thc'],
        relatedClient: 'client-1',
      }

      const req = createMockReq([])

      await computeTestResults({
        data,
        req: req as any,
        operation: 'create',
        value: undefined,
      } as any)

      expect(data.expectedPositives).toEqual([])
      expect(data.unexpectedPositives).toEqual(['thc'])
      expect(data.unexpectedNegatives).toEqual([])
      expect(data.initialScreenResult).toBe('unexpected-positive')
    })

    test('Scenario 2: Unexpected Negative (Red Flag) - Client on Oxycodone but NOT detected', async () => {
      const medications = [
        {
          medicationName: 'Oxycodone',
          status: 'active',
          detectedAs: ['oxycodone'],
        },
      ]

      const data: any = {
        detectedSubstances: [],
        relatedClient: 'client-1',
      }

      const req = createMockReq(medications)

      await computeTestResults({
        data,
        req: req as any,
        operation: 'create',
        value: undefined,
      } as any)

      expect(data.expectedPositives).toEqual([])
      expect(data.unexpectedPositives).toEqual([])
      expect(data.unexpectedNegatives).toEqual(['oxycodone'])
      expect(data.initialScreenResult).toBe('unexpected-negative')
    })

    test('Scenario 3: Mixed Unexpected - THC positive (unexpected) + Missing Oxycodone (expected)', async () => {
      const medications = [
        {
          medicationName: 'Oxycodone',
          status: 'active',
          detectedAs: ['oxycodone'],
        },
      ]

      const data: any = {
        detectedSubstances: ['thc'],
        relatedClient: 'client-1',
      }

      const req = createMockReq(medications)

      await computeTestResults({
        data,
        req: req as any,
        operation: 'create',
        value: undefined,
      } as any)

      expect(data.expectedPositives).toEqual([])
      expect(data.unexpectedPositives).toEqual(['thc'])
      expect(data.unexpectedNegatives).toEqual(['oxycodone'])
      expect(data.initialScreenResult).toBe('mixed-unexpected')
    })

    test('Scenario 4: Unexpected Positive - Client on Oxycodone (expected) + Cocaine (unexpected)', async () => {
      const medications = [
        {
          medicationName: 'Oxycodone',
          status: 'active',
          detectedAs: ['oxycodone'],
        },
      ]

      const data: any = {
        detectedSubstances: ['oxycodone', 'cocaine'],
        relatedClient: 'client-1',
      }

      const req = createMockReq(medications)

      await computeTestResults({
        data,
        req: req as any,
        operation: 'create',
        value: undefined,
      } as any)

      expect(data.expectedPositives).toEqual(['oxycodone'])
      expect(data.unexpectedPositives).toEqual(['cocaine'])
      expect(data.unexpectedNegatives).toEqual([])
      expect(data.initialScreenResult).toBe('unexpected-positive')
    })
  })

  describe('Edge Cases', () => {
    test('Should ignore discontinued medications', async () => {
      const medications = [
        {
          medicationName: 'Old Med',
          status: 'discontinued',
          detectedAs: ['oxycodone'],
        },
        {
          medicationName: 'Current Med',
          status: 'active',
          detectedAs: ['benzodiazepines'],
        },
      ]

      const data: any = {
        detectedSubstances: ['oxycodone'],
        relatedClient: 'client-1',
      }

      const req = createMockReq(medications)

      await computeTestResults({
        data,
        req: req as any,
        operation: 'create',
        value: undefined,
      } as any)

      // Oxycodone should be unexpected because the active med is discontinued
      expect(data.expectedPositives).toEqual([])
      expect(data.unexpectedPositives).toEqual(['oxycodone'])
      expect(data.unexpectedNegatives).toEqual(['benzodiazepines'])
    })

    test('Should handle medications with "Does Not Show" (none)', async () => {
      const medications = [
        {
          medicationName: 'Aspirin',
          status: 'active',
          detectedAs: ['none'],
        },
      ]

      const data: any = {
        detectedSubstances: [],
        relatedClient: 'client-1',
      }

      const req = createMockReq(medications)

      await computeTestResults({
        data,
        req: req as any,
        operation: 'create',
        value: undefined,
      } as any)

      expect(data.expectedPositives).toEqual([])
      expect(data.unexpectedPositives).toEqual([])
      expect(data.unexpectedNegatives).toEqual([])
      expect(data.initialScreenResult).toBe('negative')
    })

    test('Should handle medication that shows as multiple substances', async () => {
      const medications = [
        {
          medicationName: 'Multi-Substance Med',
          status: 'active',
          detectedAs: ['opiates', 'oxycodone'],
        },
      ]

      const data: any = {
        detectedSubstances: ['opiates', 'oxycodone'],
        relatedClient: 'client-1',
      }

      const req = createMockReq(medications)

      await computeTestResults({
        data,
        req: req as any,
        operation: 'create',
        value: undefined,
      } as any)

      expect(data.expectedPositives).toEqual(['opiates', 'oxycodone'])
      expect(data.unexpectedPositives).toEqual([])
      expect(data.unexpectedNegatives).toEqual([])
      expect(data.initialScreenResult).toBe('expected-positive')
    })
  })

  describe('Error Handling', () => {
    test('Should handle missing client gracefully', async () => {
      const data: any = {
        detectedSubstances: ['thc'],
        relatedClient: 'non-existent',
      }

      const req = {
        payload: {
          findByID: async () => null,
        },
      }

      const originalValue = undefined

      const result = await computeTestResults({
        data,
        req: req as any,
        operation: 'create',
        value: originalValue,
      } as any)

      // Should return original value without modifying data
      expect(result).toBe(originalValue)
    })

    test('Should handle missing detectedSubstances', async () => {
      const data: any = {
        relatedClient: 'client-1',
      }

      const req = createMockReq([])

      const originalValue = undefined

      const result = await computeTestResults({
        data,
        req: req as any,
        operation: 'create',
        value: originalValue,
      } as any)

      expect(result).toBe(originalValue)
    })
  })

  describe('Confirmation Results Workflow', () => {
    test('Confirmation requested with some substances', async () => {
      const medications = []

      const data: any = {
        detectedSubstances: ['thc', 'cocaine'],
        relatedClient: 'client-1',
        confirmationDecision: 'request-confirmation',
        confirmationSubstances: ['thc', 'cocaine'],
      }

      const req = createMockReq(medications)

      await computeTestResults({
        data,
        req: req as any,
        operation: 'create',
        value: undefined,
      } as any)

      // Test should classify correctly
      expect(data.initialScreenResult).toBe('unexpected-positive')
      expect(data.unexpectedPositives).toEqual(['thc', 'cocaine'])
      expect(data.expectedPositives).toEqual([])
    })

    test('Empty confirmation results array', async () => {
      const medications = []

      const data: any = {
        detectedSubstances: ['thc'],
        relatedClient: 'client-1',
        confirmationDecision: 'request-confirmation',
        confirmationSubstances: ['thc'],
        confirmationResults: [],
      }

      const req = createMockReq(medications)

      await computeTestResults({
        data,
        req: req as any,
        operation: 'create',
        value: undefined,
      } as any)

      expect(data.initialScreenResult).toBe('unexpected-positive')
      expect(data.unexpectedPositives).toEqual(['thc'])
    })

    test('Multiple confirmation results for different substances', async () => {
      const medications = []

      const data: any = {
        detectedSubstances: ['thc', 'cocaine', 'opiates'],
        relatedClient: 'client-1',
        confirmationDecision: 'request-confirmation',
        confirmationSubstances: ['thc', 'cocaine', 'opiates'],
        confirmationResults: [
          { substance: 'thc', result: 'confirmed-positive' },
          { substance: 'cocaine', result: 'confirmed-negative' },
          { substance: 'opiates', result: 'inconclusive' },
        ],
      }

      const req = createMockReq(medications)

      await computeTestResults({
        data,
        req: req as any,
        operation: 'create',
        value: undefined,
      } as any)

      // Initial result should still classify as unexpected positive
      expect(data.initialScreenResult).toBe('unexpected-positive')
      expect(data.unexpectedPositives).toEqual(['thc', 'cocaine', 'opiates'])
    })
  })
})
