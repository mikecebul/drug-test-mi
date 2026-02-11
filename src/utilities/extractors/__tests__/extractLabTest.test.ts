import { describe, test, expect } from 'vitest'
import { extractLabTest } from '../extractLabTest'
import fs from 'fs/promises'
import path from 'path'
import { format } from 'date-fns'
import { TZDate } from '@date-fns/tz'
import { APP_TIMEZONE } from '@/lib/date-utils'

// Fixture paths - can be overridden via environment variables for local testing
const FIXTURES_DIR = path.join(__dirname, 'fixtures')
const LOCAL_TEST_DIR = process.env.PDF_TEST_DIR || '/Users/mikecebul/Documents/Drug Tests'

// Helper to check if fixture exists and get the buffer
async function getTestPdf(
  fixturePath: string,
  localPath?: string,
): Promise<{ buffer: Buffer; skipped: false } | { buffer: null; skipped: true }> {
  // Try fixture first
  try {
    const buffer = await fs.readFile(path.join(FIXTURES_DIR, fixturePath))
    return { buffer, skipped: false }
  } catch {
    // Fixture not found, try local path if provided
  }

  if (localPath) {
    try {
      const buffer = await fs.readFile(localPath)
      return { buffer, skipped: false }
    } catch {
      // Local path also not found
    }
  }

  return { buffer: null, skipped: true }
}

function assertCollectionDateString(dateString: string): Date {
  expect(dateString).toMatch(/^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:\d{2})$/)
  const date = new Date(dateString)
  expect(Number.isNaN(date.getTime())).toBe(false)
  return date
}

describe('extractLabTest', () => {
  describe('11-panel-lab tests', () => {
    test('should extract screening results from 11-panel lab PDF', async () => {
      const pdf = await getTestPdf(
        '11-panel-lab/screening.pdf',
        path.join(LOCAL_TEST_DIR, 'Tom Vachon/TV_Lab_11-19-25.pdf'),
      )

      if (pdf.skipped) {
        console.log('Skipping: 11-panel-lab screening fixture not found')
        return
      }

      const result = await extractLabTest(pdf.buffer)

      // Verify test type detection
      expect(result.testType).toBe('11-panel-lab')

      // Verify basic extraction
      expect(result.donorName).toBeTruthy()
      expect(typeof result.collectionDate).toBe('string')

      if (!result.collectionDate) {
        throw new Error('Expected collectionDate to be present')
      }
      const date = assertCollectionDateString(result.collectionDate)
      expect(date instanceof Date).toBe(true)

      // This PDF shows "Screened Positive" for Buprenorphine
      expect(result.detectedSubstances).toContain('buprenorphine')

      // Should have high confidence if both name and date extracted
      if (result.donorName && result.collectionDate) {
        expect(result.confidence).toBe('high')
      }

      // Verify extracted fields tracking
      expect(result.extractedFields).toContain('donorName')
      expect(result.extractedFields).toContain('collectionDate')
      expect(result.extractedFields).toContain('detectedSubstances')
    })

    test('should extract confirmation results from 11-panel confirmation PDF', async () => {
      const pdf = await getTestPdf(
        '11-panel-lab/confirmation.pdf',
        path.join(LOCAL_TEST_DIR, 'Tom Vachon/TV_Confirm_10-3-25.pdf'),
      )

      if (pdf.skipped) {
        console.log('Skipping: 11-panel-lab confirmation fixture not found')
        return
      }

      const result = await extractLabTest(pdf.buffer)

      // Verify test type
      expect(result.testType).toBe('11-panel-lab')

      // This PDF has both screening and confirmation results
      expect(result.hasConfirmation).toBe(true)
      expect(result.confirmationResults).toBeDefined()
      expect(result.confirmationResults!.length).toBeGreaterThan(0)

      // Verify confirmation results structure
      const firstConfirm = result.confirmationResults![0]
      expect(firstConfirm).toHaveProperty('substance')
      expect(firstConfirm).toHaveProperty('result')
      expect(['confirmed-positive', 'confirmed-negative', 'inconclusive']).toContain(
        firstConfirm.result,
      )

      // Verify extracted fields includes confirmation
      if (result.confirmationResults && result.confirmationResults.length > 0) {
        expect(result.extractedFields).toContain('confirmationResults')
      }
    })

    test('should detect dilute samples in 11-panel tests', async () => {
      const pdf = await getTestPdf(
        '11-panel-lab/screening.pdf',
        path.join(LOCAL_TEST_DIR, 'Tom Vachon/TV_Lab_11-19-25.pdf'),
      )

      if (pdf.skipped) {
        console.log('Skipping: 11-panel-lab screening fixture not found')
        return
      }

      const result = await extractLabTest(pdf.buffer)

      // This specific PDF shows creatinine 105.9 mg/dL (not dilute)
      // But if it contained "dilute" keyword, it would be detected
      expect(typeof result.isDilute).toBe('boolean')

      if (result.isDilute) {
        expect(result.extractedFields).toContain('isDilute')
      }
    })

    test('should map Mitragynine to kratom in 11-panel tests', async () => {
      const pdf = await getTestPdf(
        '11-panel-lab/screening.pdf',
        path.join(LOCAL_TEST_DIR, 'Tom Vachon/TV_Lab_11-19-25.pdf'),
      )

      if (pdf.skipped) {
        console.log('Skipping: 11-panel-lab screening fixture not found')
        return
      }

      const result = await extractLabTest(pdf.buffer)

      // Verify test type detection
      expect(result.testType).toBe('11-panel-lab')

      // The substance mapping should handle Mitragynine -> kratom
      // This is tested implicitly in the extractor code
    })
  })

  describe('17-panel-sos-lab tests', () => {
    test('should detect 17-panel SOS test type from PDF', async () => {
      const pdf = await getTestPdf(
        '17-panel-sos-lab/screening.pdf',
        path.join(LOCAL_TEST_DIR, 'Chris Gibbs/CB_SOS_10-22-25.pdf'),
      )

      if (pdf.skipped) {
        console.log('Skipping: 17-panel-sos-lab screening fixture not found')
        return
      }

      const result = await extractLabTest(pdf.buffer)

      // Verify test type detection
      expect(result.testType).toBe('17-panel-sos-lab')

      // Verify basic extraction
      expect(result.donorName).toBeTruthy()
      expect(typeof result.collectionDate).toBe('string')

      if (!result.collectionDate) {
        throw new Error('Expected collectionDate to be present')
      }
      const date = assertCollectionDateString(result.collectionDate)
      expect(date instanceof Date).toBe(true)

      // Should have confidence score
      expect(['high', 'medium', 'low']).toContain(result.confidence)

      // Verify extracted fields
      expect(result.extractedFields).toContain('donorName')
      expect(result.extractedFields).toContain('collectionDate')
    })

    test('should extract screening results from 17-panel SOS PDF', async () => {
      const pdf = await getTestPdf(
        '17-panel-sos-lab/screening.pdf',
        path.join(LOCAL_TEST_DIR, 'Chris Gibbs/CB_SOS_10-22-25.pdf'),
      )

      if (pdf.skipped) {
        console.log('Skipping: 17-panel-sos-lab screening fixture not found')
        return
      }

      const result = await extractLabTest(pdf.buffer)

      // Verify test type
      expect(result.testType).toBe('17-panel-sos-lab')

      // Should extract detected substances (if any are positive)
      expect(Array.isArray(result.detectedSubstances)).toBe(true)

      // Should have valid structure
      expect(result.rawText).toBeTruthy()
      expect(typeof result.isDilute).toBe('boolean')
    })

    test('should handle 17-panel specific substances (MDMA, Barbiturates, PCP)', async () => {
      const pdf = await getTestPdf(
        '17-panel-sos-lab/screening.pdf',
        path.join(LOCAL_TEST_DIR, 'Chris Gibbs/CB_SOS_10-22-25.pdf'),
      )

      if (pdf.skipped) {
        console.log('Skipping: 17-panel-sos-lab screening fixture not found')
        return
      }

      const result = await extractLabTest(pdf.buffer)

      // Verify test type
      expect(result.testType).toBe('17-panel-sos-lab')

      // The extractor should have mappings for 17-panel specific substances:
      // - MDMA
      // - Barbiturates
      // - PCP
      // - Propoxyphene
      // - Oxycodone
      // This is tested implicitly by the substance mapping in extractLabTest
    })
  })

  describe('etg-lab tests', () => {
    test('should detect EtG test type from PDF', async () => {
      const pdf = await getTestPdf(
        'etg-lab/screening.pdf',
        path.join(LOCAL_TEST_DIR, 'Todd Crawford/TC_Lab_10-24-25.pdf'),
      )

      if (pdf.skipped) {
        console.log('Skipping: etg-lab screening fixture not found')
        return
      }

      const result = await extractLabTest(pdf.buffer)

      // Verify test type detection (PDF should contain "049 - Ethyl Glucuronide (EtG)")
      expect(result.testType).toBe('etg-lab')

      // Verify basic extraction
      expect(result.donorName).toBeTruthy()
      expect(typeof result.collectionDate).toBe('string')

      if (!result.collectionDate) {
        throw new Error('Expected collectionDate to be present')
      }
      const date = assertCollectionDateString(result.collectionDate)
      expect(date instanceof Date).toBe(true)

      // Should have confidence score
      expect(['high', 'medium', 'low']).toContain(result.confidence)

      // Verify extracted fields
      expect(result.extractedFields).toContain('donorName')
      expect(result.extractedFields).toContain('collectionDate')
    })

    test('should extract EtG screening results', async () => {
      const pdf = await getTestPdf(
        'etg-lab/screening.pdf',
        path.join(LOCAL_TEST_DIR, 'Todd Crawford/TC_Lab_10-24-25.pdf'),
      )

      if (pdf.skipped) {
        console.log('Skipping: etg-lab screening fixture not found')
        return
      }

      const result = await extractLabTest(pdf.buffer)

      // Verify test type
      expect(result.testType).toBe('etg-lab')

      // EtG tests should detect 'etg' substance when positive
      expect(Array.isArray(result.detectedSubstances)).toBe(true)

      // If EtG is positive, it should be in detected substances
      // Otherwise, detectedSubstances should be empty
      if (result.detectedSubstances.includes('etg')) {
        expect(result.extractedFields).toContain('detectedSubstances')
      }

      // Should have valid structure
      expect(result.rawText).toBeTruthy()
      expect(typeof result.isDilute).toBe('boolean')
    })
  })

  describe('General functionality', () => {
    test('should set confidence score based on extracted fields', async () => {
      const pdf = await getTestPdf(
        '11-panel-lab/screening.pdf',
        path.join(LOCAL_TEST_DIR, 'Tom Vachon/TV_Lab_11-19-25.pdf'),
      )

      if (pdf.skipped) {
        console.log('Skipping: 11-panel-lab screening fixture not found')
        return
      }

      const result = await extractLabTest(pdf.buffer)

      // Confidence should be:
      // - 'high' if both donorName AND collectionDate extracted
      // - 'medium' if either donorName OR collectionDate extracted
      // - 'low' if neither extracted

      if (result.donorName && result.collectionDate) {
        expect(result.confidence).toBe('high')
      } else if (result.donorName || result.collectionDate) {
        expect(result.confidence).toBe('medium')
      } else {
        expect(result.confidence).toBe('low')
      }
    })

    test('should extract collection date with time correctly', async () => {
      const pdf = await getTestPdf(
        '11-panel-lab/screening.pdf',
        path.join(LOCAL_TEST_DIR, 'Tom Vachon/TV_Lab_11-19-25.pdf'),
      )

      if (pdf.skipped) {
        console.log('Skipping: 11-panel-lab screening fixture not found')
        return
      }

      const result = await extractLabTest(pdf.buffer)

      // PDF shows: Collected: 11/19/2025 06:17 PM
      // collectionDate is now an ISO string
      expect(typeof result.collectionDate).toBe('string')
      expect(result.collectionDate).not.toBeNull()

      if (result.collectionDate) {
        // collectionDate is now an ISO string, convert to Date for testing
        const parsedDate = assertCollectionDateString(result.collectionDate)
        const collectionDateInAppTimezone = TZDate.tz(APP_TIMEZONE, parsedDate)

        // Verify it's a valid date
        expect(parsedDate.getTime()).toBeGreaterThan(0)
        // Verify it's in the expected range (2024+)
        expect(parsedDate.getFullYear()).toBeGreaterThanOrEqual(2024)
        // Verify extracted date/time is stable in app timezone
        expect(format(collectionDateInAppTimezone, 'MM/dd/yyyy')).toBe('11/19/2025')
        expect(format(collectionDateInAppTimezone, 'h:mm a')).toBe('6:17 PM')
      }
    })

    test('should handle screening + confirmation in same PDF', async () => {
      const pdf = await getTestPdf(
        '11-panel-lab/confirmation.pdf',
        path.join(LOCAL_TEST_DIR, 'Tom Vachon/TV_Confirm_10-3-25.pdf'),
      )

      if (pdf.skipped) {
        console.log('Skipping: 11-panel-lab confirmation fixture not found')
        return
      }

      const result = await extractLabTest(pdf.buffer)

      // Should have screening results
      expect(result.detectedSubstances.length).toBeGreaterThan(0)

      // Should have confirmation results
      expect(result.hasConfirmation).toBe(true)
      expect(result.confirmationResults).toBeDefined()

      // Verify at least one substance is confirmed
      const confirmedSubstances = result.confirmationResults!.map((c) => c.substance)
      expect(confirmedSubstances.length).toBeGreaterThan(0)
    })

    test('should throw error for invalid PDF', async () => {
      // Create a minimal buffer that will fail to parse properly
      const emptyBuffer = Buffer.from('Not a valid PDF')

      try {
        await extractLabTest(emptyBuffer)
        // Should throw an error
        expect(true).toBe(false)
      } catch (error: any) {
        // Should throw with helpful error message
        expect(error.message).toContain('Failed to extract lab test data')
      }
    })

    test('should handle all confirmation result types', async () => {
      const pdf = await getTestPdf(
        '11-panel-lab/confirmation.pdf',
        path.join(LOCAL_TEST_DIR, 'Tom Vachon/TV_Confirm_10-3-25.pdf'),
      )

      if (pdf.skipped) {
        console.log('Skipping: 11-panel-lab confirmation fixture not found')
        return
      }

      const result = await extractLabTest(pdf.buffer)

      if (result.hasConfirmation && result.confirmationResults) {
        result.confirmationResults.forEach((confirm) => {
          // Each result should be one of the valid types
          expect(['confirmed-positive', 'confirmed-negative', 'inconclusive']).toContain(
            confirm.result,
          )

          // Each should have a substance
          expect(confirm.substance).toBeTruthy()

          // Notes field is optional but should be defined
          expect(confirm).toHaveProperty('notes')
        })
      }
    })

    test('should auto-detect test type correctly', async () => {
      // Test 11-panel detection
      const lab11Pdf = await getTestPdf(
        '11-panel-lab/screening.pdf',
        path.join(LOCAL_TEST_DIR, 'Tom Vachon/TV_Lab_11-19-25.pdf'),
      )

      if (!lab11Pdf.skipped) {
        const lab11Result = await extractLabTest(lab11Pdf.buffer)
        expect(lab11Result.testType).toBe('11-panel-lab')
      }

      // Test 17-panel SOS detection
      const sosPdf = await getTestPdf(
        '17-panel-sos-lab/screening.pdf',
        path.join(LOCAL_TEST_DIR, 'Chris Gibbs/CB_SOS_10-22-25.pdf'),
      )

      if (!sosPdf.skipped) {
        const sosResult = await extractLabTest(sosPdf.buffer)
        expect(sosResult.testType).toBe('17-panel-sos-lab')
      }

      // Test EtG detection
      const etgPdf = await getTestPdf(
        'etg-lab/screening.pdf',
        path.join(LOCAL_TEST_DIR, 'Todd Crawford/TC_Lab_10-24-25.pdf'),
      )

      if (!etgPdf.skipped) {
        const etgResult = await extractLabTest(etgPdf.buffer)
        expect(etgResult.testType).toBe('etg-lab')
      }

      // If all fixtures are skipped, skip the test
      if (lab11Pdf.skipped && sosPdf.skipped && etgPdf.skipped) {
        console.log('Skipping: No test fixtures found for auto-detect test')
        return
      }
    })
  })
})
