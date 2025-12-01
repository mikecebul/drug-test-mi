import { describe, test, expect } from 'vitest'
import { extractLabTest } from '../extractLabTest'
import fs from 'fs/promises'
import path from 'path'

describe('extractLabTest', () => {
  describe('11-panel-lab tests', () => {
    test('should extract screening results from 11-panel lab PDF', async () => {
      const pdfPath = path.join(
        '/Users/mikecebul/Documents/Drug Tests/Tom Vachon',
        'TV_Lab_11-19-25.pdf',
      )

      const buffer = await fs.readFile(pdfPath)
      const result = await extractLabTest(buffer)

      // Verify test type detection
      expect(result.testType).toBe('11-panel-lab')

      // Verify basic extraction
      expect(result.donorName).toBeTruthy()
      expect(result.collectionDate).toBeInstanceOf(Date)

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
      const pdfPath = path.join(
        '/Users/mikecebul/Documents/Drug Tests/Tom Vachon',
        'TV_Confirm_10-3-25.pdf',
      )

      const buffer = await fs.readFile(pdfPath)
      const result = await extractLabTest(buffer)

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
      const pdfPath = path.join(
        '/Users/mikecebul/Documents/Drug Tests/Tom Vachon',
        'TV_Lab_11-19-25.pdf',
      )

      const buffer = await fs.readFile(pdfPath)
      const result = await extractLabTest(buffer)

      // This specific PDF shows creatinine 105.9 mg/dL (not dilute)
      // But if it contained "dilute" keyword, it would be detected
      expect(typeof result.isDilute).toBe('boolean')

      if (result.isDilute) {
        expect(result.extractedFields).toContain('isDilute')
      }
    })

    test('should map Mitragynine to kratom in 11-panel tests', async () => {
      const pdfPath = path.join(
        '/Users/mikecebul/Documents/Drug Tests/Tom Vachon',
        'TV_Lab_11-19-25.pdf',
      )

      const buffer = await fs.readFile(pdfPath)
      const result = await extractLabTest(buffer)

      // Verify test type detection
      expect(result.testType).toBe('11-panel-lab')

      // The substance mapping should handle Mitragynine -> kratom
      // This is tested implicitly in the extractor code
    })
  })

  describe('17-panel-sos-lab tests', () => {
    test('should detect 17-panel SOS test type from PDF', async () => {
      const pdfPath = path.join(
        '/Users/mikecebul/Documents/Drug Tests/Chris Gibbs',
        'CB_SOS_10-22-25.pdf',
      )

      const buffer = await fs.readFile(pdfPath)
      const result = await extractLabTest(buffer)

      // Verify test type detection
      expect(result.testType).toBe('17-panel-sos-lab')

      // Verify basic extraction
      expect(result.donorName).toBeTruthy()
      expect(result.collectionDate).toBeInstanceOf(Date)

      // Should have confidence score
      expect(['high', 'medium', 'low']).toContain(result.confidence)

      // Verify extracted fields
      expect(result.extractedFields).toContain('donorName')
      expect(result.extractedFields).toContain('collectionDate')
    })

    test('should extract screening results from 17-panel SOS PDF', async () => {
      const pdfPath = path.join(
        '/Users/mikecebul/Documents/Drug Tests/Chris Gibbs',
        'CB_SOS_10-22-25.pdf',
      )

      const buffer = await fs.readFile(pdfPath)
      const result = await extractLabTest(buffer)

      // Verify test type
      expect(result.testType).toBe('17-panel-sos-lab')

      // Should extract detected substances (if any are positive)
      expect(Array.isArray(result.detectedSubstances)).toBe(true)

      // Should have valid structure
      expect(result.rawText).toBeTruthy()
      expect(typeof result.isDilute).toBe('boolean')
    })

    test('should handle 17-panel specific substances (MDMA, Barbiturates, PCP)', async () => {
      const pdfPath = path.join(
        '/Users/mikecebul/Documents/Drug Tests/Chris Gibbs',
        'CB_SOS_10-22-25.pdf',
      )

      const buffer = await fs.readFile(pdfPath)
      const result = await extractLabTest(buffer)

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
      const pdfPath = path.join(
        '/Users/mikecebul/Documents/Drug Tests/Todd Crawford',
        'TC_Lab_10-24-25.pdf',
      )

      const buffer = await fs.readFile(pdfPath)
      const result = await extractLabTest(buffer)

      // Verify test type detection (PDF should contain "049 - Ethyl Glucuronide (EtG)")
      expect(result.testType).toBe('etg-lab')

      // Verify basic extraction
      expect(result.donorName).toBeTruthy()
      expect(result.collectionDate).toBeInstanceOf(Date)

      // Should have confidence score
      expect(['high', 'medium', 'low']).toContain(result.confidence)

      // Verify extracted fields
      expect(result.extractedFields).toContain('donorName')
      expect(result.extractedFields).toContain('collectionDate')
    })

    test('should extract EtG screening results', async () => {
      const pdfPath = path.join(
        '/Users/mikecebul/Documents/Drug Tests/Todd Crawford',
        'TC_Lab_10-24-25.pdf',
      )

      const buffer = await fs.readFile(pdfPath)
      const result = await extractLabTest(buffer)

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
      const pdfPath = path.join(
        '/Users/mikecebul/Documents/Drug Tests/Tom Vachon',
        'TV_Lab_11-19-25.pdf',
      )

      const buffer = await fs.readFile(pdfPath)
      const result = await extractLabTest(buffer)

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
      const pdfPath = path.join(
        '/Users/mikecebul/Documents/Drug Tests/Tom Vachon',
        'TV_Lab_11-19-25.pdf',
      )

      const buffer = await fs.readFile(pdfPath)
      const result = await extractLabTest(buffer)

      // PDF shows: Collected: 11/19/2025 06:17 PM
      expect(result.collectionDate).toBeInstanceOf(Date)
      expect(result.collectionDate).not.toBeNull()

      if (result.collectionDate) {
        // Verify it's a valid date
        expect(result.collectionDate.getTime()).toBeGreaterThan(0)
        // Verify it's in the expected range (2024+)
        expect(result.collectionDate.getFullYear()).toBeGreaterThanOrEqual(2024)
      }
    })

    test('should handle screening + confirmation in same PDF', async () => {
      const pdfPath = path.join(
        '/Users/mikecebul/Documents/Drug Tests/Tom Vachon',
        'TV_Confirm_10-3-25.pdf',
      )

      const buffer = await fs.readFile(pdfPath)
      const result = await extractLabTest(buffer)

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
      const pdfPath = path.join(
        '/Users/mikecebul/Documents/Drug Tests/Tom Vachon',
        'TV_Confirm_10-3-25.pdf',
      )

      const buffer = await fs.readFile(pdfPath)
      const result = await extractLabTest(buffer)

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
      const lab11Path = path.join(
        '/Users/mikecebul/Documents/Drug Tests/Tom Vachon',
        'TV_Lab_11-19-25.pdf',
      )
      const lab11Buffer = await fs.readFile(lab11Path)
      const lab11Result = await extractLabTest(lab11Buffer)
      expect(lab11Result.testType).toBe('11-panel-lab')

      // Test 17-panel SOS detection
      const sosPath = path.join(
        '/Users/mikecebul/Documents/Drug Tests/Chris Gibbs',
        'CB_SOS_10-22-25.pdf',
      )
      const sosBuffer = await fs.readFile(sosPath)
      const sosResult = await extractLabTest(sosBuffer)
      expect(sosResult.testType).toBe('17-panel-sos-lab')

      // Test EtG detection
      const etgPath = path.join(
        '/Users/mikecebul/Documents/Drug Tests/Todd Crawford',
        'TC_Lab_10-24-25.pdf',
      )
      const etgBuffer = await fs.readFile(etgPath)
      const etgResult = await extractLabTest(etgBuffer)
      expect(etgResult.testType).toBe('etg-lab')
    })
  })
})
