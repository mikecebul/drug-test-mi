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
  logger: {
    error: () => {},
    warn: () => {},
    info: () => {},
  },
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
        screeningStatus: 'screened',
      }

      const req = createMockReq([])

      await computeTestResults({
        data,
        req: req as any,
        operation: 'create',
      } as any)

      expect(data.expectedPositives).toEqual([])
      expect(data.unexpectedPositives).toEqual([])
      expect(data.unexpectedNegatives).toEqual([])
      expect(data.initialScreenResult).toBe('negative')
      expect(data.confirmationDecision).toBe('accept')
      expect(data.isComplete).toBe(true)
    })

    test('Scenario 2: Expected Positive - Client on Oxycodone, test shows Oxycodone', async () => {
      const medicationsSnapshot = [
        {
          medicationName: 'Oxycodone',
          detectedAs: ['oxycodone'],
          required: false,
        },
      ]

      const data: any = {
        detectedSubstances: ['oxycodone'],
        relatedClient: 'client-1',
        screeningStatus: 'screened',
        medicationsArrayAtTestTime: medicationsSnapshot,
      }

      const req = createMockReq([])

      await computeTestResults({
        data,
        req: req as any,
        operation: 'create',
      } as any)

      expect(data.expectedPositives).toEqual(['oxycodone'])
      expect(data.unexpectedPositives).toEqual([])
      expect(data.unexpectedNegatives).toEqual([])
      expect(data.initialScreenResult).toBe('expected-positive')
      expect(data.confirmationDecision).toBe('accept')
      expect(data.isComplete).toBe(true)
    })

    test('Scenario 3: Expected Positive - Multiple medications all showing correctly', async () => {
      const medicationsSnapshot = [
        {
          medicationName: 'Oxycodone',
          detectedAs: ['oxycodone'],
          requireConfirmation: false,
        },
        {
          medicationName: 'Xanax',
          detectedAs: ['benzodiazepines'],
          requireConfirmation: false,
        },
      ]

      const data: any = {
        detectedSubstances: ['oxycodone', 'benzodiazepines'],
        relatedClient: 'client-1',
        screeningStatus: 'screened',
        medicationsArrayAtTestTime: medicationsSnapshot,
      }

      const req = createMockReq([])

      await computeTestResults({
        data,
        req: req as any,
        operation: 'create',
      } as any)

      expect(data.expectedPositives).toEqual(['oxycodone', 'benzodiazepines'])
      expect(data.unexpectedPositives).toEqual([])
      expect(data.unexpectedNegatives).toEqual([])
      expect(data.initialScreenResult).toBe('expected-positive')
      expect(data.confirmationDecision).toBe('accept')
      expect(data.isComplete).toBe(true)
    })
  })

  describe('FAIL Scenarios', () => {
    test('Scenario 1: Unexpected Positive - THC detected, no THC medication', async () => {
      const data: any = {
        detectedSubstances: ['thc'],
        relatedClient: 'client-1',
        screeningStatus: 'screened',
      }

      const req = createMockReq([])

      await computeTestResults({
        data,
        req: req as any,
        operation: 'create',
      } as any)

      expect(data.expectedPositives).toEqual([])
      expect(data.unexpectedPositives).toEqual(['thc'])
      expect(data.unexpectedNegatives).toEqual([])
      expect(data.initialScreenResult).toBe('unexpected-positive')
      expect(data.confirmationDecision).toBeUndefined() // Should NOT auto-accept
      expect(data.isComplete).toBe(false) // Should NOT be complete
    })

    test('Scenario 2a: Critical Unexpected Negative - Client on MAT medication (requireConfirmation=true) but NOT detected', async () => {
      const medicationsSnapshot = [
        {
          medicationName: 'Buprenorphine',
          detectedAs: ['buprenorphine'],
          required: true, // MAT medication must show
        },
      ]

      const data: any = {
        detectedSubstances: [],
        relatedClient: 'client-1',
        screeningStatus: 'screened',
        medicationsArrayAtTestTime: medicationsSnapshot,
      }

      const req = createMockReq([])

      await computeTestResults({
        data,
        req: req as any,
        operation: 'create',
      } as any)

      expect(data.expectedPositives).toEqual([])
      expect(data.unexpectedPositives).toEqual([])
      expect(data.unexpectedNegatives).toEqual(['buprenorphine'])
      expect(data.initialScreenResult).toBe('unexpected-negative-critical')
      expect(data.confirmationDecision).toBeUndefined() // Should NOT auto-accept
      expect(data.isComplete).toBe(false) // Should NOT be complete
    })

    test('Scenario 2b: Warning Unexpected Negative - Non-critical medication (requireConfirmation=false) not detected', async () => {
      const medicationsSnapshot = [
        {
          medicationName: 'Oxycodone',
          detectedAs: ['oxycodone'],
          required: false, // Not critical - just monitor
        },
      ]

      const data: any = {
        detectedSubstances: [],
        relatedClient: 'client-1',
        screeningStatus: 'screened',
        medicationsArrayAtTestTime: medicationsSnapshot,
      }

      const req = createMockReq([])

      await computeTestResults({
        data,
        req: req as any,
        operation: 'create',
      } as any)

      expect(data.expectedPositives).toEqual([])
      expect(data.unexpectedPositives).toEqual([])
      expect(data.unexpectedNegatives).toEqual(['oxycodone'])
      expect(data.initialScreenResult).toBe('unexpected-negative-warning')
      expect(data.confirmationDecision).toBe('accept') // Should auto-accept warnings
      expect(data.isComplete).toBe(true) // Should be complete
    })

    test('Scenario 3: Mixed Unexpected - THC positive (unexpected) + Missing Oxycodone (expected)', async () => {
      const medicationsSnapshot = [
        {
          medicationName: 'Oxycodone',
          detectedAs: ['oxycodone'],
          required: false,
        },
      ]

      const data: any = {
        detectedSubstances: ['thc'],
        relatedClient: 'client-1',
        screeningStatus: 'screened',
        medicationsArrayAtTestTime: medicationsSnapshot,
      }

      const req = createMockReq([])

      await computeTestResults({
        data,
        req: req as any,
        operation: 'create',
      } as any)

      expect(data.expectedPositives).toEqual([])
      expect(data.unexpectedPositives).toEqual(['thc'])
      expect(data.unexpectedNegatives).toEqual(['oxycodone'])
      expect(data.initialScreenResult).toBe('mixed-unexpected')
    })

    test('Scenario 4: Unexpected Positive - Client on Oxycodone (expected) + Cocaine (unexpected)', async () => {
      const medicationsSnapshot = [
        {
          medicationName: 'Oxycodone',
          detectedAs: ['oxycodone'],
          required: false,
        },
      ]

      const data: any = {
        detectedSubstances: ['oxycodone', 'cocaine'],
        relatedClient: 'client-1',
        screeningStatus: 'screened',
        medicationsArrayAtTestTime: medicationsSnapshot,
      }

      const req = createMockReq([])

      await computeTestResults({
        data,
        req: req as any,
        operation: 'create',
      } as any)

      expect(data.expectedPositives).toEqual(['oxycodone'])
      expect(data.unexpectedPositives).toEqual(['cocaine'])
      expect(data.unexpectedNegatives).toEqual([])
      expect(data.initialScreenResult).toBe('unexpected-positive')
    })
  })

  describe('Edge Cases', () => {
    test('Should ignore discontinued medications', async () => {
      const medicationsSnapshot = [
        {
          medicationName: 'Current Med',
          detectedAs: ['benzodiazepines'],
          required: false,
        },
        // Note: Discontinued medications should not be in the snapshot at test time
      ]

      const data: any = {
        detectedSubstances: ['oxycodone'],
        relatedClient: 'client-1',
        screeningStatus: 'screened',
        medicationsArrayAtTestTime: medicationsSnapshot,
      }

      const req = createMockReq([])

      await computeTestResults({
        data,
        req: req as any,
        operation: 'create',
      } as any)

      // Oxycodone should be unexpected because no active medication for it
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
        screeningStatus: 'screened',
      }

      const req = createMockReq(medications)

      await computeTestResults({
        data,
        req: req as any,
        operation: 'create',
      } as any)

      expect(data.expectedPositives).toEqual([])
      expect(data.unexpectedPositives).toEqual([])
      expect(data.unexpectedNegatives).toEqual([])
      expect(data.initialScreenResult).toBe('negative')
    })

    test('Should handle medication that shows as multiple substances', async () => {
      const medicationsSnapshot = [
        {
          medicationName: 'Multi-Substance Med',
          detectedAs: ['opiates', 'oxycodone'],
          required: false,
        },
      ]

      const data: any = {
        detectedSubstances: ['opiates', 'oxycodone'],
        relatedClient: 'client-1',
        screeningStatus: 'screened',
        medicationsArrayAtTestTime: medicationsSnapshot,
      }

      const req = createMockReq([])

      await computeTestResults({
        data,
        req: req as any,
        operation: 'create',
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

      const result = await computeTestResults({
        data,
        req: req as any,
        operation: 'create',
      } as any)

      // Should return data unchanged when client not found
      expect(result).toEqual(data)
      expect(result.initialScreenResult).toBeUndefined()
    })

    test('Should handle missing detectedSubstances', async () => {
      const data: any = {
        relatedClient: 'client-1',
        screeningStatus: 'screened',
      }

      const req = createMockReq([])

      const result = await computeTestResults({
        data,
        req: req as any,
        operation: 'create',
      } as any)

      // Should still compute results with empty detected substances
      expect(result.initialScreenResult).toBe('negative')
      expect(result.confirmationDecision).toBe('accept')
      expect(result.isComplete).toBe(true)
    })
  })

  describe('Confirmation Results Workflow', () => {
    test('Confirmation requested with some substances', async () => {
      const medications = []

      const data: any = {
        detectedSubstances: ['thc', 'cocaine'],
        relatedClient: 'client-1',
        screeningStatus: 'screened',
        confirmationDecision: 'request-confirmation',
        confirmationSubstances: ['thc', 'cocaine'],
      }

      const req = createMockReq(medications)

      await computeTestResults({
        data,
        req: req as any,
        operation: 'create',
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
        screeningStatus: 'screened',
        confirmationDecision: 'request-confirmation',
        confirmationSubstances: ['thc'],
        confirmationResults: [],
      }

      const req = createMockReq(medications)

      await computeTestResults({
        data,
        req: req as any,
        operation: 'create',
      } as any)

      expect(data.initialScreenResult).toBe('unexpected-positive')
      expect(data.unexpectedPositives).toEqual(['thc'])
    })

    test('Multiple confirmation results for different substances', async () => {
      const medications = []

      const data: any = {
        detectedSubstances: ['thc', 'cocaine', 'opiates'],
        relatedClient: 'client-1',
        screeningStatus: 'screened',
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
      } as any)

      // Initial result should still classify as unexpected positive
      expect(data.initialScreenResult).toBe('unexpected-positive')
      expect(data.unexpectedPositives).toEqual(['thc', 'cocaine', 'opiates'])
    })
  })

  describe('requireConfirmation Field Scenarios', () => {
    test('Mix of critical and warning medications - only critical missing should fail', async () => {
      const medicationsSnapshot = [
        {
          medicationName: 'Buprenorphine (MAT)',
          detectedAs: ['buprenorphine'],
          required: true, // Critical
        },
        {
          medicationName: 'Gabapentin',
          detectedAs: ['gabapentin'],
          required: false, // Not critical
        },
      ]

      const data: any = {
        detectedSubstances: ['gabapentin'], // Only non-critical showing
        relatedClient: 'client-1',
        screeningStatus: 'screened',
        medicationsArrayAtTestTime: medicationsSnapshot,
      }

      const req = createMockReq([])

      await computeTestResults({
        data,
        req: req as any,
        operation: 'create',
      } as any)

      expect(data.expectedPositives).toEqual(['gabapentin'])
      expect(data.unexpectedPositives).toEqual([])
      expect(data.unexpectedNegatives).toEqual(['buprenorphine'])
      expect(data.initialScreenResult).toBe('unexpected-negative-critical')
      expect(data.confirmationDecision).toBeUndefined() // Should NOT auto-accept
      expect(data.isComplete).toBe(false)
    })

    test('Mix of critical and warning medications - only warning missing should pass', async () => {
      const medicationsSnapshot = [
        {
          medicationName: 'Buprenorphine (MAT)',
          detectedAs: ['buprenorphine'],
          required: true, // Critical
        },
        {
          medicationName: 'Gabapentin',
          detectedAs: ['gabapentin'],
          required: false, // Not critical
        },
      ]

      const data: any = {
        detectedSubstances: ['buprenorphine'], // Only critical showing
        relatedClient: 'client-1',
        screeningStatus: 'screened',
        medicationsArrayAtTestTime: medicationsSnapshot,
      }

      const req = createMockReq([])

      await computeTestResults({
        data,
        req: req as any,
        operation: 'create',
      } as any)

      expect(data.expectedPositives).toEqual(['buprenorphine'])
      expect(data.unexpectedPositives).toEqual([])
      expect(data.unexpectedNegatives).toEqual(['gabapentin'])
      expect(data.initialScreenResult).toBe('unexpected-negative-warning')
      expect(data.confirmationDecision).toBe('accept') // Should auto-accept warnings
      expect(data.isComplete).toBe(true)
    })

    test('Default behavior when requireConfirmation not set should be non-critical', async () => {
      const medicationsSnapshot = [
        {
          medicationName: 'Oxycodone',
          detectedAs: ['oxycodone'],
          // required not set - defaults to false
        },
      ]

      const data: any = {
        detectedSubstances: [],
        relatedClient: 'client-1',
        screeningStatus: 'screened',
        medicationsArrayAtTestTime: medicationsSnapshot,
      }

      const req = createMockReq([])

      await computeTestResults({
        data,
        req: req as any,
        operation: 'create',
      } as any)

      expect(data.initialScreenResult).toBe('unexpected-negative-warning')
      expect(data.confirmationDecision).toBe('accept') // Should auto-accept
      expect(data.isComplete).toBe(true)
    })
  })
})
