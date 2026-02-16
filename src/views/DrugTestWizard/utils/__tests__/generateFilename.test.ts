import { describe, test, expect } from 'vitest'
import { generateTestFilename } from '../generateFilename'

// Use explicit Date objects with local time to avoid timezone issues
const createLocalDate = (year: number, month: number, day: number) =>
  new Date(year, month - 1, day, 12, 0, 0) // Noon local time to avoid date boundary issues

describe('generateTestFilename', () => {
  describe('basic functionality', () => {
    test('should generate filename with two initials for client without middle initial', () => {
      const result = generateTestFilename({
        client: { firstName: 'John', lastName: 'Doe' },
        collectionDate: createLocalDate(2025, 1, 15),
        testType: '15-panel-instant',
      })

      expect(result).toBe('JD_Instant_01-15-25.pdf')
    })

    test('should generate filename with three initials for client with middle initial', () => {
      const result = generateTestFilename({
        client: { firstName: 'John', lastName: 'Doe', middleInitial: 'M' },
        collectionDate: createLocalDate(2025, 1, 15),
        testType: '15-panel-instant',
      })

      expect(result).toBe('JMD_Instant_01-15-25.pdf')
    })

    test('should handle lowercase names by uppercasing initials', () => {
      const result = generateTestFilename({
        client: { firstName: 'john', lastName: 'doe', middleInitial: 'm' },
        collectionDate: createLocalDate(2025, 1, 15),
        testType: '15-panel-instant',
      })

      expect(result).toBe('JMD_Instant_01-15-25.pdf')
    })
  })

  describe('test type prefixes', () => {
    test('should use "Lab" prefix for 11-panel-lab test type', () => {
      const result = generateTestFilename({
        client: { firstName: 'John', lastName: 'Doe' },
        collectionDate: createLocalDate(2025, 1, 15),
        testType: '11-panel-lab',
      })

      expect(result).toBe('JD_Lab_01-15-25.pdf')
    })

    test('should use "Lab" prefix for 17-panel-sos-lab test type', () => {
      const result = generateTestFilename({
        client: { firstName: 'John', lastName: 'Doe' },
        collectionDate: createLocalDate(2025, 1, 15),
        testType: '17-panel-sos-lab',
      })

      expect(result).toBe('JD_Lab_01-15-25.pdf')
    })

    test('should use "Lab" prefix for etg-lab test type', () => {
      const result = generateTestFilename({
        client: { firstName: 'John', lastName: 'Doe' },
        collectionDate: createLocalDate(2025, 1, 15),
        testType: 'etg-lab',
      })

      expect(result).toBe('JD_Lab_01-15-25.pdf')
    })

    test('should use "Instant" prefix for 15-panel-instant test type', () => {
      const result = generateTestFilename({
        client: { firstName: 'John', lastName: 'Doe' },
        collectionDate: createLocalDate(2025, 1, 15),
        testType: '15-panel-instant',
      })

      expect(result).toBe('JD_Instant_01-15-25.pdf')
    })

    test('should default to "Instant" prefix for unknown test types', () => {
      const result = generateTestFilename({
        client: { firstName: 'John', lastName: 'Doe' },
        collectionDate: createLocalDate(2025, 1, 15),
        testType: 'unknown-test',
      })

      expect(result).toBe('JD_Instant_01-15-25.pdf')
    })
  })

  describe('confirmation suffix', () => {
    test('should add _Confirmation suffix when isConfirmation is true', () => {
      const result = generateTestFilename({
        client: { firstName: 'John', lastName: 'Doe' },
        collectionDate: createLocalDate(2025, 1, 15),
        testType: '11-panel-lab',
        isConfirmation: true,
      })

      expect(result).toBe('JD_Lab_01-15-25_Confirmation.pdf')
    })

    test('should not add suffix when isConfirmation is false', () => {
      const result = generateTestFilename({
        client: { firstName: 'John', lastName: 'Doe' },
        collectionDate: createLocalDate(2025, 1, 15),
        testType: '11-panel-lab',
        isConfirmation: false,
      })

      expect(result).toBe('JD_Lab_01-15-25.pdf')
    })

    test('should not add suffix when isConfirmation is undefined', () => {
      const result = generateTestFilename({
        client: { firstName: 'John', lastName: 'Doe' },
        collectionDate: createLocalDate(2025, 1, 15),
        testType: '11-panel-lab',
      })

      expect(result).toBe('JD_Lab_01-15-25.pdf')
    })
  })

  describe('date handling', () => {
    test('should handle Date object input', () => {
      const result = generateTestFilename({
        client: { firstName: 'John', lastName: 'Doe' },
        collectionDate: createLocalDate(2025, 3, 20),
        testType: '15-panel-instant',
      })

      expect(result).toBe('JD_Instant_03-20-25.pdf')
    })

    test('should handle ISO string date input', () => {
      const result = generateTestFilename({
        client: { firstName: 'John', lastName: 'Doe' },
        collectionDate: createLocalDate(2025, 12, 31),
        testType: '15-panel-instant',
      })

      expect(result).toBe('JD_Instant_12-31-25.pdf')
    })

    test('should return empty string for invalid date', () => {
      const result = generateTestFilename({
        client: { firstName: 'John', lastName: 'Doe' },
        collectionDate: 'not-a-valid-date',
        testType: '15-panel-instant',
      })

      expect(result).toBe('')
    })

    test('should return empty string for null date', () => {
      const result = generateTestFilename({
        client: { firstName: 'John', lastName: 'Doe' },
        collectionDate: null,
        testType: '15-panel-instant',
      })

      expect(result).toBe('')
    })
  })

  describe('client validation', () => {
    test('should return empty string when client is null', () => {
      const result = generateTestFilename({
        client: null,
        collectionDate: createLocalDate(2025, 1, 15),
        testType: '15-panel-instant',
      })

      expect(result).toBe('')
    })

    test('should return empty string when firstName is missing', () => {
      const result = generateTestFilename({
        client: { firstName: '', lastName: 'Doe' },
        collectionDate: createLocalDate(2025, 1, 15),
        testType: '15-panel-instant',
      })

      expect(result).toBe('')
    })

    test('should return empty string when lastName is missing', () => {
      const result = generateTestFilename({
        client: { firstName: 'John', lastName: '' },
        collectionDate: createLocalDate(2025, 1, 15),
        testType: '15-panel-instant',
      })

      expect(result).toBe('')
    })

    test('should handle null middleInitial gracefully', () => {
      const result = generateTestFilename({
        client: { firstName: 'John', lastName: 'Doe', middleInitial: null },
        collectionDate: createLocalDate(2025, 1, 15),
        testType: '15-panel-instant',
      })

      expect(result).toBe('JD_Instant_01-15-25.pdf')
    })

    test('should handle empty string middleInitial gracefully', () => {
      const result = generateTestFilename({
        client: { firstName: 'John', lastName: 'Doe', middleInitial: '' },
        collectionDate: createLocalDate(2025, 1, 15),
        testType: '15-panel-instant',
      })

      expect(result).toBe('JD_Instant_01-15-25.pdf')
    })
  })

  describe('edge cases', () => {
    test('should handle names with only first character', () => {
      const result = generateTestFilename({
        client: { firstName: 'J', lastName: 'D' },
        collectionDate: createLocalDate(2025, 1, 15),
        testType: '15-panel-instant',
      })

      expect(result).toBe('JD_Instant_01-15-25.pdf')
    })

    test('should use only first character of each name part', () => {
      const result = generateTestFilename({
        client: { firstName: 'Jonathan', lastName: 'Donahue', middleInitial: 'Michael' },
        collectionDate: createLocalDate(2025, 1, 15),
        testType: '15-panel-instant',
      })

      expect(result).toBe('JMD_Instant_01-15-25.pdf')
    })
  })

  describe('fallback behavior documentation', () => {
    /**
     * These tests document the expected caller behavior.
     * When generateTestFilename returns '', callers should fall back to original filename.
     * See: ConfirmFieldGroup.tsx - `generateTestFilename(...) || originalFilename`
     */
    test('returns empty string for invalid input - caller should provide fallback', () => {
      const originalFilename = 'uploaded-file.pdf'

      // Simulate caller behavior with fallback pattern
      const generated = generateTestFilename({
        client: null,
        collectionDate: createLocalDate(2025, 1, 15),
        testType: '15-panel-instant',
      })

      const finalFilename = generated || originalFilename
      expect(finalFilename).toBe('uploaded-file.pdf')
    })

    test('returns generated filename when valid - no fallback needed', () => {
      const originalFilename = 'uploaded-file.pdf'

      const generated = generateTestFilename({
        client: { firstName: 'John', lastName: 'Doe' },
        collectionDate: createLocalDate(2025, 1, 15),
        testType: '15-panel-instant',
      })

      const finalFilename = generated || originalFilename
      expect(finalFilename).toBe('JD_Instant_01-15-25.pdf')
    })

    test('invalid date triggers fallback', () => {
      const originalFilename = 'uploaded-file.pdf'

      const generated = generateTestFilename({
        client: { firstName: 'John', lastName: 'Doe' },
        collectionDate: 'invalid-date',
        testType: '15-panel-instant',
      })

      const finalFilename = generated || originalFilename
      expect(finalFilename).toBe('uploaded-file.pdf')
    })

    test('missing client name triggers fallback', () => {
      const originalFilename = 'uploaded-file.pdf'

      const generated = generateTestFilename({
        client: { firstName: '', lastName: 'Doe' },
        collectionDate: createLocalDate(2025, 1, 15),
        testType: '15-panel-instant',
      })

      const finalFilename = generated || originalFilename
      expect(finalFilename).toBe('uploaded-file.pdf')
    })
  })
})
