import { describe, expect, test } from 'vitest'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { extract15PanelInstant, extractInstantDonorName } from '../extract15PanelInstant'

describe('instant extraction from required PDFs', () => {
  test.each([
    ['17-panel-instant/all-neg.pdf', '17-panel-instant', 'Michael J Cebulski', 17, []],
    ['17-panel-instant/pos-kratom-morphine.pdf', '17-panel-instant', 'Bob F Testing', 17, ['kratom', 'morphine']],
    ['15-panel-instant/screening.pdf', '15-panel-instant', 'Sample Q Donor', 15, ['buprenorphine']],
    ['17-panel-instant/multi-positive.pdf', '17-panel-instant', 'Sample Q Donor', 17, ['etg', 'thc']],
  ])('extracts all rows and positives from %s', async (file, testType, donorName, resultRowCount, positives) => {
    const result = await extract15PanelInstant(await readFile(path.join(__dirname, 'fixtures', file)))
    expect(result).toMatchObject({
      testType,
      donorName,
      resultRowCount,
      resultsComplete: true,
      confidence: 'high',
      parseWarnings: [],
    })
    expect(result.detectedSubstances.toSorted()).toEqual(positives.toSorted())
    expect(result.detectedSubstances).not.toContain('opiates')
    expect(result.extractedFields).toEqual(
      expect.arrayContaining(['donorName', 'collectionDate', 'detectedSubstances', 'testType']),
    )
  })
  test('anchors identity and collection time to their labels', async () => {
    const result = await extract15PanelInstant(
      await readFile(path.join(__dirname, 'fixtures/15-panel-instant/screening.pdf')),
    )
    expect(result).toMatchObject({
      donorName: 'Sample Q Donor',
      dob: '01/15/1990',
      gender: 'M',
      isDilute: false,
    })
    expect(new Date(result.collectionDate!).toISOString()).toBe('2025-11-20T23:27:00.000Z')
  })
  test('rejects an invalid report', async () => {
    await expect(extract15PanelInstant(Buffer.from('Not a valid PDF'))).rejects.toThrow(
      'Failed to extract 15-panel instant test data',
    )
  })
})

describe('donor surname normalization', () => {
  test.each(['-', '\u2010', '\u2011', '\u2013', '\u2212', '\u00AD', ' - ', '-\n'])(
    'preserves Cole-Hess with separator %j',
    (separator) => {
      expect(extractInstantDonorName(`Phone: (248)555-1212\nJordan Q Cole${separator}Hess\niCup Urine`)).toBe(
        'Jordan Q Cole-Hess',
      )
    },
  )
})
