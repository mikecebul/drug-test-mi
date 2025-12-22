import { describe, test, expect } from 'vitest'
import { extract15PanelInstant } from '../extract15PanelInstant'
import fs from 'fs/promises'
import path from 'path'

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

describe('extract15PanelInstant', () => {
  test('should extract screening results from instant test PDF', async () => {
    const pdf = await getTestPdf(
      '15-panel-instant/screening.pdf',
      path.join(LOCAL_TEST_DIR, 'Dennis Erfourth/DE_Instant_11-20-25.pdf'),
    )

    if (pdf.skipped) {
      console.log('Skipping: 15-panel-instant screening fixture not found')
      return
    }

    const result = await extract15PanelInstant(pdf.buffer)

    // Verify basic extraction
    expect(result.donorName).toBeTruthy()

    expect(typeof result.collectionDate).toBe('string')

    if (!result.collectionDate) {
      throw new Error('Expected collectionDate to be present')
    }
    const date = new Date(result.collectionDate)
    expect(date instanceof Date).toBe(true)
    expect(Number.isNaN(date.getTime())).toBe(false)
    expect(date.toISOString()).toBe(result.collectionDate)

    // This PDF shows "Presumptive Positive" for Buprenorphine
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

  test('should extract donor name correctly', async () => {
    const pdf = await getTestPdf(
      '15-panel-instant/screening.pdf',
      path.join(LOCAL_TEST_DIR, 'Dennis Erfourth/DE_Instant_11-20-25.pdf'),
    )

    if (pdf.skipped) {
      console.log('Skipping: 15-panel-instant screening fixture not found')
      return
    }

    const result = await extract15PanelInstant(pdf.buffer)

    // PDF shows: Dennis D Erfourth
    expect(result.donorName).toBe('Dennis D Erfourth')
    expect(result.extractedFields).toContain('donorName')
  })

  test('should extract collection date correctly', async () => {
    const pdf = await getTestPdf(
      '15-panel-instant/screening.pdf',
      path.join(LOCAL_TEST_DIR, 'Dennis Erfourth/DE_Instant_11-20-25.pdf'),
    )

    if (pdf.skipped) {
      console.log('Skipping: 15-panel-instant screening fixture not found')
      return
    }

    const result = await extract15PanelInstant(pdf.buffer)

    // PDF shows: Collected: 06:27 PM  11/20/2025
    // collectionDate is now an ISO string
    expect(typeof result.collectionDate).toBe('string')
    expect(result.collectionDate).not.toBeNull()

    if (result.collectionDate) {
      // collectionDate is now an ISO string, convert to Date for testing
      const parsedDate = new Date(result.collectionDate)

      // Verify it's a valid date
      expect(parsedDate.getTime()).toBeGreaterThan(0)
      // Verify it's in the expected range (2025)
      expect(parsedDate.getFullYear()).toBeGreaterThanOrEqual(2024)

      // Verify specific date and time
      const dateStr = parsedDate.toLocaleDateString('en-US')
      expect(dateStr).toBe('11/20/2025')

      const timeStr = parsedDate.toLocaleTimeString('en-US')
      expect(timeStr).toContain('6:27')
    }
  })

  test('should detect Presumptive Positive results', async () => {
    const pdf = await getTestPdf(
      '15-panel-instant/screening.pdf',
      path.join(LOCAL_TEST_DIR, 'Dennis Erfourth/DE_Instant_11-20-25.pdf'),
    )

    if (pdf.skipped) {
      console.log('Skipping: 15-panel-instant screening fixture not found')
      return
    }

    const result = await extract15PanelInstant(pdf.buffer)

    // This PDF shows Buprenorphine as "Presumptive Positive"
    expect(result.detectedSubstances).toContain('buprenorphine')
    expect(result.detectedSubstances.length).toBe(1) // Only Buprenorphine should be positive
  })

  test('should not detect false positives from Negative results', async () => {
    const pdf = await getTestPdf(
      '15-panel-instant/screening.pdf',
      path.join(LOCAL_TEST_DIR, 'Dennis Erfourth/DE_Instant_11-20-25.pdf'),
    )

    if (pdf.skipped) {
      console.log('Skipping: 15-panel-instant screening fixture not found')
      return
    }

    const result = await extract15PanelInstant(pdf.buffer)

    // These substances are marked as Negative in the PDF
    const negativeSubstances = [
      '6-mam',
      'amphetamines',
      'benzodiazepines',
      'cocaine',
      'etg',
      'fentanyl',
      'mdma',
      'methadone',
      'methamphetamines',
      'opiates',
      'oxycodone',
      'synthetic_cannabinoids',
      'thc',
      'tramadol',
    ]

    for (const substance of negativeSubstances) {
      expect(result.detectedSubstances).not.toContain(substance)
    }
  })

  test('should detect dilute samples', async () => {
    const pdf = await getTestPdf(
      '15-panel-instant/screening.pdf',
      path.join(LOCAL_TEST_DIR, 'Dennis Erfourth/DE_Instant_11-20-25.pdf'),
    )

    if (pdf.skipped) {
      console.log('Skipping: 15-panel-instant screening fixture not found')
      return
    }

    const result = await extract15PanelInstant(pdf.buffer)

    // This specific PDF is not dilute, but test the boolean type
    expect(typeof result.isDilute).toBe('boolean')

    if (result.isDilute) {
      expect(result.extractedFields).toContain('isDilute')
    }
  })

  test('should set confidence score based on extracted fields', async () => {
    const pdf = await getTestPdf(
      '15-panel-instant/screening.pdf',
      path.join(LOCAL_TEST_DIR, 'Dennis Erfourth/DE_Instant_11-20-25.pdf'),
    )

    if (pdf.skipped) {
      console.log('Skipping: 15-panel-instant screening fixture not found')
      return
    }

    const result = await extract15PanelInstant(pdf.buffer)

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

  test('should include raw text in results', async () => {
    const pdf = await getTestPdf(
      '15-panel-instant/screening.pdf',
      path.join(LOCAL_TEST_DIR, 'Dennis Erfourth/DE_Instant_11-20-25.pdf'),
    )

    if (pdf.skipped) {
      console.log('Skipping: 15-panel-instant screening fixture not found')
      return
    }

    const result = await extract15PanelInstant(pdf.buffer)

    // Verify raw text is present
    expect(result.rawText).toBeTruthy()
    expect(result.rawText.length).toBeGreaterThan(0)

    // Verify it contains expected content
    expect(result.rawText).toContain('Dennis')
    expect(result.rawText).toContain('Buprenorphine')
    expect(result.rawText).toContain('Presumptive Positive')
  })

  test('should handle substance name variations', async () => {
    const pdf = await getTestPdf(
      '15-panel-instant/screening.pdf',
      path.join(LOCAL_TEST_DIR, 'Dennis Erfourth/DE_Instant_11-20-25.pdf'),
    )

    if (pdf.skipped) {
      console.log('Skipping: 15-panel-instant screening fixture not found')
      return
    }

    const result = await extract15PanelInstant(pdf.buffer)

    // Verify substance mapping works for various formats
    // The PDF uses "Methylenedioxymethamphetamine (MDMA) Ecstasy"
    // Our mapping should handle both "MDMA" and "Methylenedioxymethamphetamine"
    expect(result.detectedSubstances).not.toContain('mdma') // Should be negative in this PDF

    // Verify 6-MAM mapping
    expect(result.detectedSubstances).not.toContain('6-mam') // Should be negative in this PDF
  })

  test('should return valid structure even with parsing errors', async () => {
    // Create a minimal buffer that will fail to parse properly
    const emptyBuffer = Buffer.from('Not a valid PDF')

    try {
      await extract15PanelInstant(emptyBuffer)
      // Should throw an error
      expect(true).toBe(false)
    } catch (error: any) {
      // Should throw with helpful error message
      expect(error.message).toContain('Failed to extract 15-panel instant test data')
    }
  })

  test('should track all extracted fields correctly', async () => {
    const pdf = await getTestPdf(
      '15-panel-instant/screening.pdf',
      path.join(LOCAL_TEST_DIR, 'Dennis Erfourth/DE_Instant_11-20-25.pdf'),
    )

    if (pdf.skipped) {
      console.log('Skipping: 15-panel-instant screening fixture not found')
      return
    }

    const result = await extract15PanelInstant(pdf.buffer)

    // extractedFields should contain an entry for each successfully extracted field
    expect(Array.isArray(result.extractedFields)).toBe(true)

    // For this PDF, we expect at least donor name, date, and substances
    expect(result.extractedFields.length).toBeGreaterThan(0)

    // All values should be valid field names
    const validFields = [
      'donorName',
      'collectionDate',
      'detectedSubstances',
      'isDilute',
      'dob',
      'gender',
    ]
    for (const field of result.extractedFields) {
      expect(validFields).toContain(field)
    }
  })
})
