import { describe, test, expect } from 'vitest'
import { filterByScreeningStatus, filterByTestType, calculateTestMatchScore, getRankedTestMatches, type DrugTest } from '../testMatching'

// Helper function to create mock test data
function createMockTest(
  overrides: Partial<DrugTest> = {},
): DrugTest {
  return {
    id: '123',
    clientName: 'John Doe',
    testType: '11-panel-lab',
    collectionDate: '2025-01-15T10:00:00Z',
    screeningStatus: 'collected',
    clientHeadshot: null,
    ...overrides,
  }
}

describe('filterByScreeningStatus', () => {
  test('returns all tests when not a screen workflow', () => {
    const tests = [
      createMockTest({ id: '1', screeningStatus: 'collected' }),
      createMockTest({ id: '2', screeningStatus: 'screened' }),
      createMockTest({ id: '3', screeningStatus: 'complete' }),
    ]

    const result = filterByScreeningStatus(tests, false)
    expect(result).toHaveLength(3)
    expect(result).toEqual(tests)
  })

  test('filters out screened tests when in screen workflow', () => {
    const tests = [
      createMockTest({ id: '1', screeningStatus: 'collected' }),
      createMockTest({ id: '2', screeningStatus: 'screened' }),
      createMockTest({ id: '3', screeningStatus: 'collected' }),
    ]

    const result = filterByScreeningStatus(tests, true)
    expect(result).toHaveLength(2)
    expect(result.every(t => t.screeningStatus === 'collected')).toBe(true)
  })

  test('filters out complete tests when in screen workflow', () => {
    const tests = [
      createMockTest({ id: '1', screeningStatus: 'collected' }),
      createMockTest({ id: '2', screeningStatus: 'complete' }),
    ]

    const result = filterByScreeningStatus(tests, true)
    expect(result).toHaveLength(1)
    expect(result[0].screeningStatus).toBe('collected')
  })

  test('returns empty array when all tests are screened/complete in screen workflow', () => {
    const tests = [
      createMockTest({ id: '1', screeningStatus: 'screened' }),
      createMockTest({ id: '2', screeningStatus: 'complete' }),
    ]

    const result = filterByScreeningStatus(tests, true)
    expect(result).toHaveLength(0)
  })

  test('handles empty input array', () => {
    const result = filterByScreeningStatus([], true)
    expect(result).toHaveLength(0)
  })
})

describe('filterByTestType', () => {
  test('returns all tests when no test type provided', () => {
    const tests = [
      createMockTest({ id: '1', testType: '11-panel-lab' }),
      createMockTest({ id: '2', testType: '15-panel-instant' }),
      createMockTest({ id: '3', testType: 'etg-lab' }),
    ]

    const result = filterByTestType(tests, undefined)
    expect(result).toHaveLength(3)
  })

  test('filters to only 11-panel lab tests', () => {
    const tests = [
      createMockTest({ id: '1', testType: '11-panel-lab' }),
      createMockTest({ id: '2', testType: '15-panel-instant' }),
      createMockTest({ id: '3', testType: '11-panel-lab' }),
    ]

    const result = filterByTestType(tests, '11-panel-lab')
    expect(result).toHaveLength(2)
    expect(result.every(t => t.testType === '11-panel-lab')).toBe(true)
  })

  test('filters to only 15-panel instant tests', () => {
    const tests = [
      createMockTest({ id: '1', testType: '15-panel-instant' }),
      createMockTest({ id: '2', testType: '11-panel-lab' }),
    ]

    const result = filterByTestType(tests, '15-panel-instant')
    expect(result).toHaveLength(1)
    expect(result[0].testType).toBe('15-panel-instant')
  })

  test('filters to only EtG lab tests', () => {
    const tests = [
      createMockTest({ id: '1', testType: 'etg-lab' }),
      createMockTest({ id: '2', testType: '11-panel-lab' }),
    ]

    const result = filterByTestType(tests, 'etg-lab')
    expect(result).toHaveLength(1)
    expect(result[0].testType).toBe('etg-lab')
  })

  test('filters to only 17-panel SOS lab tests', () => {
    const tests = [
      createMockTest({ id: '1', testType: '17-panel-sos-lab' }),
      createMockTest({ id: '2', testType: '11-panel-lab' }),
    ]

    const result = filterByTestType(tests, '17-panel-sos-lab')
    expect(result).toHaveLength(1)
    expect(result[0].testType).toBe('17-panel-sos-lab')
  })

  test('returns empty array when no tests match type', () => {
    const tests = [
      createMockTest({ id: '1', testType: '11-panel-lab' }),
      createMockTest({ id: '2', testType: '15-panel-instant' }),
    ]

    const result = filterByTestType(tests, 'etg-lab')
    expect(result).toHaveLength(0)
  })

  test('handles empty input array', () => {
    const result = filterByTestType([], '11-panel-lab')
    expect(result).toHaveLength(0)
  })
})

describe('calculateTestMatchScore', () => {
  describe('name matching', () => {
    test('returns 60 points for perfect name match', () => {
      const test = createMockTest({ clientName: 'John Doe' })
      const score = calculateTestMatchScore('John Doe', null, test)
      expect(score).toBe(60)
    })

    test('returns high score for very similar names', () => {
      const test = createMockTest({ clientName: 'John Smith' })
      const score = calculateTestMatchScore('Jon Smith', null, test)
      // Jon vs John is very similar (0.75 similarity)
      // 0.75 * 0.3 (first) + 1.0 * 0.6 (last) + 1.0 * 0.1 (middle) = 0.925
      // 0.925 * 60 = 55.5
      expect(score).toBeGreaterThan(50)
      expect(score).toBeLessThan(60)
    })

    test('returns high score for same last name, different first name', () => {
      const test = createMockTest({ clientName: 'Jane Smith' })
      const score = calculateTestMatchScore('John Smith', null, test)
      // Last name match (60% weight) should dominate
      expect(score).toBeGreaterThan(40)
      expect(score).toBeLessThan(60)
    })

    test('returns lower score for different names', () => {
      const test = createMockTest({ clientName: 'Jane Doe' })
      const score = calculateTestMatchScore('John Smith', null, test)
      expect(score).toBeLessThan(30)
    })

    test('returns 0 when no name provided', () => {
      const test = createMockTest({ clientName: 'John Doe' })
      const score = calculateTestMatchScore(null, null, test)
      expect(score).toBe(0)
    })

    test('handles names with middle initials', () => {
      const test = createMockTest({ clientName: 'John M Doe' })
      const score = calculateTestMatchScore('John M Doe', null, test)
      expect(score).toBe(60)
    })

    test('is case insensitive', () => {
      const test = createMockTest({ clientName: 'john doe' })
      const score = calculateTestMatchScore('JOHN DOE', null, test)
      expect(score).toBe(60)
    })
  })

  describe('date matching', () => {
    test('returns high score for same calendar day', () => {
      const test = createMockTest({ collectionDate: '2025-01-15T10:00:00Z' })
      // Using UTC date to ensure consistency
      const score = calculateTestMatchScore(null, '2025-01-15T00:00:00Z', test)
      expect(score).toBeGreaterThanOrEqual(30)
      expect(score).toBeLessThanOrEqual(40)
    })

    test('returns 30+ points for date within 1 day', () => {
      const test = createMockTest({ collectionDate: '2025-01-15T10:00:00Z' })
      const score = calculateTestMatchScore(null, '2025-01-16T00:00:00Z', test)
      expect(score).toBeGreaterThanOrEqual(30)
      expect(score).toBeLessThanOrEqual(40)
    })

    test('returns 20 points for date within 3 days', () => {
      const test = createMockTest({ collectionDate: '2025-01-15T10:00:00Z' })
      const score = calculateTestMatchScore(null, new Date('2025-01-18').toISOString(), test)
      expect(score).toBe(20)
    })

    test('returns 10 points for date within 7 days', () => {
      const test = createMockTest({ collectionDate: '2025-01-15T10:00:00Z' })
      const score = calculateTestMatchScore(null, new Date('2025-01-20').toISOString(), test)
      expect(score).toBe(10)
    })

    test('returns 0 points for date more than 7 days apart', () => {
      const test = createMockTest({ collectionDate: '2025-01-15T10:00:00Z' })
      const score = calculateTestMatchScore(null, new Date('2025-01-25').toISOString(), test)
      expect(score).toBe(0)
    })

    test('returns 0 when no date provided', () => {
      const test = createMockTest({ collectionDate: '2025-01-15T10:00:00Z' })
      const score = calculateTestMatchScore(null, null, test)
      expect(score).toBe(0)
    })

    test('handles date objects correctly', () => {
      const test = createMockTest({ collectionDate: '2025-01-15T10:00:00Z' })
      const extractedDate = '2025-01-15T14:30:00Z'
      const score = calculateTestMatchScore(null, extractedDate, test)
      expect(score).toBeGreaterThanOrEqual(30) // Same day or very close
      expect(score).toBeLessThanOrEqual(40)
    })
  })

  describe('combined name and date matching', () => {
    test('returns very high score for perfect match', () => {
      const test = createMockTest({
        clientName: 'John Doe',
        collectionDate: '2025-01-15T10:00:00Z',
      })
      const score = calculateTestMatchScore('John Doe', '2025-01-15T00:00:00Z', test)
      expect(score).toBeGreaterThanOrEqual(90) // Should be very high, close to 100
      expect(score).toBeLessThanOrEqual(100)
    })

    test('combines partial name and date scores', () => {
      const test = createMockTest({
        clientName: 'Jane Smith',
        collectionDate: '2025-01-15T10:00:00Z',
      })
      const score = calculateTestMatchScore('John Smith', '2025-01-16T00:00:00Z', test)
      // Similar name (~45) + date close (30-40) = ~75-85
      expect(score).toBeGreaterThan(60)
      expect(score).toBeLessThan(95)
    })

    test('returns high score for good name match with close date', () => {
      const test = createMockTest({
        clientName: 'Jon Smith',
        collectionDate: '2025-01-15T10:00:00Z',
      })
      const score = calculateTestMatchScore('John Smith', '2025-01-15T00:00:00Z', test)
      // Very similar name (~55) + close date (30-40) = ~85-95
      expect(score).toBeGreaterThan(80)
      expect(score).toBeLessThan(100)
    })
  })

  describe('score properties', () => {
    test('always returns integer score', () => {
      const test = createMockTest({ clientName: 'John Doe' })
      const score = calculateTestMatchScore('Jon Doe', null, test)
      expect(Number.isInteger(score)).toBe(true)
    })

    test('score is always between 0 and 100', () => {
      const testCases = [
        ['John Doe', new Date('2025-01-15').toISOString()],
        ['Jane Smith', new Date('2025-02-20').toISOString()],
        [null, new Date('2025-01-15').toISOString()],
        ['John Doe', null],
        [null, null],
      ] as const

      const test = createMockTest({
        clientName: 'John Doe',
        collectionDate: '2025-01-15T10:00:00Z',
      })

      for (const [name, date] of testCases) {
        const score = calculateTestMatchScore(name, date, test)
        expect(score).toBeGreaterThanOrEqual(0)
        expect(score).toBeLessThanOrEqual(100)
      }
    })
  })
})

describe('getRankedTestMatches', () => {
  describe('filtering and scoring', () => {
    test('filters by test type and ranks by score', () => {
      const tests = [
        createMockTest({ id: '1', testType: '11-panel-lab', clientName: 'John Doe' }),
        createMockTest({ id: '2', testType: '15-panel-instant', clientName: 'John Doe' }),
        createMockTest({ id: '3', testType: '11-panel-lab', clientName: 'Jane Doe' }),
      ]

      const result = getRankedTestMatches(
        tests,
        'John Doe',
        null,
        '11-panel-lab',
        false,
      )

      expect(result).toHaveLength(2)
      expect(result[0].test.id).toBe('1') // Perfect match
      expect(result[0].score).toBe(60)
      expect(result[1].test.id).toBe('3') // Partial match
    })

    test('filters by screening status in screen workflow', () => {
      const tests = [
        createMockTest({ id: '1', screeningStatus: 'collected', clientName: 'John Doe' }),
        createMockTest({ id: '2', screeningStatus: 'screened', clientName: 'John Doe' }),
        createMockTest({ id: '3', screeningStatus: 'collected', clientName: 'Jane Doe' }),
      ]

      const result = getRankedTestMatches(
        tests,
        'John Doe',
        null,
        undefined,
        true, // screen workflow
      )

      expect(result).toHaveLength(2)
      expect(result.every(r => r.test.screeningStatus === 'collected')).toBe(true)
      expect(result[0].test.id).toBe('1') // Best match
    })

    test('applies both filters when specified', () => {
      const tests = [
        createMockTest({
          id: '1',
          testType: '11-panel-lab',
          screeningStatus: 'collected',
          clientName: 'John Doe',
        }),
        createMockTest({
          id: '2',
          testType: '11-panel-lab',
          screeningStatus: 'screened',
          clientName: 'John Doe',
        }),
        createMockTest({
          id: '3',
          testType: '15-panel-instant',
          screeningStatus: 'collected',
          clientName: 'John Doe',
        }),
      ]

      const result = getRankedTestMatches(
        tests,
        'John Doe',
        null,
        '11-panel-lab',
        true, // screen workflow
      )

      expect(result).toHaveLength(1)
      expect(result[0].test.id).toBe('1')
    })
  })

  describe('ranking behavior', () => {
    test('sorts results by score descending', () => {
      const tests = [
        createMockTest({
          id: '1',
          clientName: 'Jane Smith',
          collectionDate: '2025-01-20T10:00:00Z',
        }),
        createMockTest({
          id: '2',
          clientName: 'John Smith',
          collectionDate: '2025-01-15T10:00:00Z',
        }),
        createMockTest({
          id: '3',
          clientName: 'John Smith',
          collectionDate: '2025-01-16T10:00:00Z',
        }),
      ]

      const result = getRankedTestMatches(
        tests,
        'John Smith',
        '2025-01-15T00:00:00Z',
        undefined,
        false,
      )

      expect(result).toHaveLength(3)
      // First result should have highest score (perfect name + date)
      expect(result[0].test.id).toBe('2')
      expect(result[0].score).toBeGreaterThanOrEqual(90) // Very high score
      // Second should be good name + close date
      expect(result[1].test.id).toBe('3')
      expect(result[1].score).toBeGreaterThanOrEqual(80)
      // Third should have lowest score (different name)
      expect(result[2].test.id).toBe('1')
    })

    test('handles ties in scoring', () => {
      const tests = [
        createMockTest({ id: '1', clientName: 'John Doe' }),
        createMockTest({ id: '2', clientName: 'John Doe' }),
      ]

      const result = getRankedTestMatches(tests, 'John Doe', null, undefined, false)

      expect(result).toHaveLength(2)
      expect(result[0].score).toBe(60)
      expect(result[1].score).toBe(60)
    })
  })

  describe('edge cases', () => {
    test('handles empty test array', () => {
      const result = getRankedTestMatches([], 'John Doe', null, undefined, false)
      expect(result).toHaveLength(0)
    })

    test('handles no extracted data', () => {
      const tests = [
        createMockTest({ id: '1', clientName: 'John Doe' }),
        createMockTest({ id: '2', clientName: 'Jane Smith' }),
      ]

      const result = getRankedTestMatches(tests, null, null, undefined, false)

      expect(result).toHaveLength(2)
      expect(result.every(r => r.score === 0)).toBe(true)
    })

    test('returns empty array when all tests filtered out', () => {
      const tests = [
        createMockTest({ id: '1', testType: '11-Panel Lab', screeningStatus: 'screened' }),
        createMockTest({ id: '2', testType: '11-Panel Lab', screeningStatus: 'complete' }),
      ]

      const result = getRankedTestMatches(
        tests,
        'John Doe',
        null,
        '11-panel-lab',
        true, // screen workflow - filters out screened/complete
      )

      expect(result).toHaveLength(0)
    })

    test('handles only date matching', () => {
      const tests = [
        createMockTest({ id: '1', collectionDate: '2025-01-15T10:00:00Z' }),
        createMockTest({ id: '2', collectionDate: '2025-01-25T10:00:00Z' }), // More than 7 days apart
      ]

      const result = getRankedTestMatches(
        tests,
        null,
        '2025-01-15T00:00:00Z',
        undefined,
        false,
      )

      expect(result).toHaveLength(2)
      expect(result[0].test.id).toBe('1')
      expect(result[0].score).toBeGreaterThanOrEqual(30) // Close date
      expect(result[1].test.id).toBe('2')
      expect(result[1].score).toBe(0) // More than 7 days apart
    })

    test('handles only name matching', () => {
      const tests = [
        createMockTest({ id: '1', clientName: 'John Doe' }),
        createMockTest({ id: '2', clientName: 'Jane Smith' }),
      ]

      const result = getRankedTestMatches(tests, 'John Doe', null, undefined, false)

      expect(result).toHaveLength(2)
      expect(result[0].test.id).toBe('1')
      expect(result[0].score).toBe(60)
    })
  })

  describe('realistic workflow scenarios', () => {
    test('screen workflow: filters and ranks correctly', () => {
      const tests = [
        createMockTest({
          id: '1',
          testType: '11-panel-lab',
          screeningStatus: 'collected',
          clientName: 'John Smith',
          collectionDate: '2025-01-15T10:00:00Z',
        }),
        createMockTest({
          id: '2',
          testType: '11-panel-lab',
          screeningStatus: 'screened', // Should be filtered out
          clientName: 'John Smith',
          collectionDate: '2025-01-15T10:00:00Z',
        }),
        createMockTest({
          id: '3',
          testType: '15-panel-instant', // Should be filtered out (wrong type)
          screeningStatus: 'collected',
          clientName: 'John Smith',
          collectionDate: '2025-01-15T10:00:00Z',
        }),
        createMockTest({
          id: '4',
          testType: '11-panel-lab',
          screeningStatus: 'collected',
          clientName: 'Jane Smith',
          collectionDate: '2025-01-14T10:00:00Z',
        }),
      ]

      const result = getRankedTestMatches(
        tests,
        'John Smith',
        '2025-01-15T00:00:00Z',
        '11-panel-lab',
        true,
      )

      expect(result).toHaveLength(2)
      expect(result[0].test.id).toBe('1') // Perfect match
      expect(result[0].score).toBeGreaterThanOrEqual(90) // Very high score
      expect(result[1].test.id).toBe('4') // Good match with similar name and close date
    })

    test('confirmation workflow: includes all statuses', () => {
      const tests = [
        createMockTest({
          id: '1',
          testType: '11-panel-lab',
          screeningStatus: 'screened',
          clientName: 'John Smith',
        }),
        createMockTest({
          id: '2',
          testType: '11-panel-lab',
          screeningStatus: 'collected',
          clientName: 'John Smith',
        }),
      ]

      const result = getRankedTestMatches(
        tests,
        'John Smith',
        null,
        '11-panel-lab',
        false, // Not a screen workflow
      )

      expect(result).toHaveLength(2)
    })
  })
})
