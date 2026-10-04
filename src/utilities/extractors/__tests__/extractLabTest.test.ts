import { describe, expect, test } from 'vitest'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import {
  calculateLabConfidence,
  extractLabDonorName,
  extractLabTest,
  parseCreatinineResult,
  parseScreenRows,
} from '../extractLabTest'
import type { PositionedTextLine } from '../pdfText'

const extract = async (name: string) => extractLabTest(await readFile(path.join(__dirname, 'fixtures', name)))
const line = (items: string[]): PositionedTextLine => ({
  page: 1,
  y: 100,
  text: items.join('\t'),
  items: items.map((text, index) => ({ text, x: index * 100, y: 100, width: 80, height: 10, page: 1 })),
})

describe('lab extraction from required synthetic PDFs', () => {
  test.each([
    ['11-panel-lab', 10, ['buprenorphine']],
    ['11-panel-lab-no-etg', 10, ['alcohol']],
    ['8-panel-lab', 7, ['buprenorphine']],
    ['17-panel-sos-lab', 14, ['mdma', 'barbiturates', 'pcp']],
    ['etg-lab', 1, ['etg']],
  ])('extracts identity and every screening row for %s', async (type, rows, positives) => {
    const result = await extract(`${type}/screening.pdf`)
    expect(result).toMatchObject({
      testType: type,
      donorName: 'Sample Q Donor',
      resultRowCount: rows,
      resultsComplete: true,
      confidence: 'high',
      confidenceScore: 100,
      isDilute: false,
      hasConfirmation: false,
      parseWarnings: [],
    })
    expect(result.detectedSubstances).toEqual(positives)
    expect(new Date(result.collectionDate!).toISOString()).toBe('2025-11-19T23:17:00.000Z')
    expect(result.extractedFields).toEqual(
      expect.arrayContaining(['donorName', 'collectionDate', 'detectedSubstances']),
    )
  })
  test('extracts multiple positives without adding negative substances', async () => {
    expect((await extract('11-panel-lab/multi-positive.pdf')).detectedSubstances).toEqual(['etg', 'thc'])
  })
  test.each([
    ['confirmation', 'fentanyl', 'confirmed-negative'],
    ['confirmed-positive', 'thc', 'confirmed-positive'],
    ['inconclusive', 'fentanyl', 'inconclusive'],
  ])('extracts %s analytes and preserves the original positive screen', async (file, substance, result) => {
    const extracted = await extract(`11-panel-lab/${file}.pdf`)
    expect(extracted.hasConfirmation).toBe(true)
    expect(extracted.confirmationResults).toEqual([expect.objectContaining({ substance, result })])
    expect(extracted.detectedSubstances).toEqual([substance])
    expect(extracted.parseWarnings).toEqual([])
    expect(extracted.extractedFields).toContain('confirmationResults')
  })
  test('requires manual review when a screening row is missing', async () => {
    const result = await extract('11-panel-lab/incomplete.pdf')
    expect(result).toMatchObject({ resultRowCount: 9, resultsComplete: false, confidence: 'medium' })
    expect(result.confidenceScore).toBeLessThan(85)
    expect(result.parseWarnings).toHaveLength(1)
  })
  test('marks a dilute specimen using its measured creatinine', async () => {
    expect(await extract('11-panel-lab/dilute.pdf')).toMatchObject({ isDilute: true, resultsComplete: true })
  })
  test('rejects an invalid report', async () => {
    await expect(extractLabTest(Buffer.from('Not a valid PDF'))).rejects.toThrow('Failed to extract lab test data')
  })
})

describe('lab parsing safeguards', () => {
  test('preserves a hyphenated donor surname', () => {
    expect(extractLabDonorName('Accession #:\nJordan Q Cole\u2011Hess\n07/14/2026')).toBe('Jordan Q Cole-Hess')
  })
  test('distinguishes ethanol EA from EtG EIA and maps Mitragynine to kratom', () => {
    const screen = parseScreenRows([
      line(['Alcohol (Ethanol)', 'EA', '0.04 g/dL', 'Positive']),
      line(['EtG', 'EIA', '500 ng/mL', 'Negative']),
      line(['Mitragynine', 'EIA', '500 ng/mL', 'Positive']),
    ])
    expect(screen.parsedRowCount).toBe(3)
    expect([...screen.rows]).toEqual([
      ['alcohol', 'positive'],
      ['etg', 'negative'],
      ['kratom', 'positive'],
    ])
  })
  test.each([
    ['144.2 mg/dL', false],
    ['12 mg/dL', true],
    ['<20 mg/dL', true],
  ])('interprets creatinine %s', (value, isDilute) => {
    expect(parseCreatinineResult([line(['Creatinine', 'Colorimetric', '20 mg/dL', value])])).toMatchObject({ isDilute })
  })
  test.each([true, false])('caps confidence when completeness is %s', (resultsComplete) => {
    const confidence = calculateLabConfidence({
      donorName: 'Sample Q Donor',
      donorNameAnchored: true,
      collectionDate: '2026-08-15T15:31:00.000Z',
      resultRowCount: resultsComplete ? 10 : 9,
      resultsComplete,
      creatinineResultFound: true,
      confirmationRowCount: 0,
    })
    expect(confidence.confidenceScore).toBe(resultsComplete ? 100 : 84)
  })
})
