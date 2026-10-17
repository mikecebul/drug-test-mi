import { describe, expect, test } from 'vitest'
import { extractLabTest, parseScreenRows } from './extractLabTest'
import { interpretConfirmation, parseLabMeasurement } from './labConfirmation'
import { extractLabTableRows } from './labReportLayout'
import type { PositionedTextLine } from './pdfText'

import { makeReportPdf as pdf, type Cell } from './__tests__/helpers/reportPdf'
const cells = (y: number, values: [number, string][]): Cell[] => values.map(([x, text]) => ({ x, y, text }))
const identity = [
  ...cells(760, [[40, 'B729 - Urine 11 Panel']]),
  ...cells(740, [
    [40, 'Identification:'],
    [160, 'Sample'],
    [203, 'Q'],
    [218, 'Donor'],
    [400, 'Client:'],
    [450, 'Test clinic'],
  ]),
  ...cells(720, [
    [40, 'Collected:'],
    [160, '11/19/2025'],
    [230, '06:17 PM'],
    [400, 'Specimen Type:'],
    [495, 'Urine'],
  ]),
  ...cells(700, [
    [40, 'DOB:'],
    [160, '01/15/1990'],
  ]),
]
const headings = (y: number) =>
  cells(y, [
    [40, 'Drug Class'],
    [236, 'Method'],
    [276, 'Cutoff'],
    [323, 'Result'],
    [401, 'Method'],
    [441, 'Cutoff'],
    [488, 'Result'],
  ])
const substances = [
  'Amphetamines 500',
  'Benzodiazepines',
  'Buprenorphine',
  'Cocaine',
  'EtG',
  'Fentanyl',
  'Mitragynine',
  'Methadone',
  'Opiates',
  'THC',
]
const screen = (start: number) =>
  substances.flatMap((name, index) =>
    cells(start - index * 22, [
      [40, name],
      [236, 'EIA'],
      [276, '5 ng/mL'],
      [323, name === 'Fentanyl' ? 'Screened Positive' : 'Negative'],
    ]),
  )
const confirmation = (y: number, label: string, result: string, cutoff = '5 ng/mL') =>
  cells(y, [
    [40, label],
    [401, 'LC/MS/MS'],
    [441, cutoff],
    [488, result],
  ])

describe('coordinate-based lab report extraction', () => {
  test.each([520, 400])(
    'separates simultaneous screen and confirmation columns below a variable-height summary (%s)',
    async (headerY) => {
      const document = await extractLabTest(
        pdf([
          [
            ...identity,
            ...headings(headerY),
            ...screen(headerY - 24),
            ...cells(headerY - 24 - 2 * 22, [
              [401, 'LC/MS/MS'],
              [441, '5 ng/mL'],
              [488, 'Confirmed Positive'],
            ]),
          ],
        ]),
      )
      expect(document).toMatchObject({
        donorName: 'Sample Q Donor',
        dob: '01/15/1990',
        reportKind: 'screening-and-confirmation',
        hasScreening: true,
        hasConfirmation: true,
        confirmationComplete: true,
        resultsComplete: true,
        resultRowCount: 10,
        parseWarnings: [],
      })
      expect(new Date(document.collectionDate!).toISOString()).toBe('2025-11-19T23:17:00.000Z')
      expect(document.detectedSubstances).toEqual(['fentanyl'])
      expect(document.confirmationResults).toEqual([
        expect.objectContaining({ substance: 'buprenorphine', result: 'confirmed-positive' }),
      ])
      expect(document.confirmationAnalytes[0].source).toMatchObject({ page: 1, bounds: expect.any(Array) })
    },
  )
  test('extracts analyte-specific summary concentrations without using a creatinine ratio', async () => {
    const document = await extractLabTest(
      pdf([
        [
          ...identity,
          ...cells(660, [
            [195, 'Summary'],
            [475, 'Tests Ordered'],
          ]),
          ...cells(640, [[40, 'Confirmed Positive for the following drug(s):']]),
          ...cells(620, [[40, 'THC-COOH (Marijuana) (937 ng/mL)']]),
          ...cells(600, [[40, 'THC-COOH/Creatinine Ratio (480 ng THC-COOH/mg Creat)']]),
          ...headings(500),
          ...confirmation(474, 'THC-COOH (Marijuana)', 'CONFIRMED POSITIVE'),
        ],
      ]),
    )
    expect(document).toMatchObject({
      reportKind: 'confirmation',
      resultsComplete: true,
      confirmationComplete: true,
      detectedSubstances: [],
      parseWarnings: [],
    })
    expect(document.confirmationAnalytes[0]).toMatchObject({
      measured: { value: 937, unit: 'ng/ml' },
      cutoff: { value: 5 },
      result: 'confirmed-positive',
    })
    expect(document.confirmationResults[0].notes).toContain('937 ng/mL')
    expect(document.confirmationResults[0].notes).not.toContain('480')
  })
  test('parses split method/units and repeated headers across pages, without importing the glossary', async () => {
    const document = await extractLabTest(
      pdf([
        [...identity, ...headings(500), ...confirmation(475, 'Fentanyl', '<5 ng/mL')],
        [
          ...headings(740),
          ...cells(715, [
            [40, 'Nor fentanyl'],
            [401, 'LC'],
            [411, '/'],
            [414, 'MS'],
            [425, '/'],
            [428, 'MS'],
            [455, '5'],
            [463, 'ng/mL'],
            [488, 'Negative'],
          ]),
          ...cells(680, [[40, 'Method Index']]),
          ...cells(660, [
            [40, 'THC'],
            [401, 'LC/MS/MS'],
            [441, '1'],
            [488, 'Positive'],
          ]),
        ],
      ]),
    )
    expect(document).toMatchObject({ reportKind: 'confirmation', confirmationComplete: true, parseWarnings: [] })
    expect(document.confirmationAnalytes.map((row) => row.source.page)).toEqual([1, 2])
    expect(document.confirmationResults).toEqual([
      expect.objectContaining({ substance: 'fentanyl', result: 'confirmed-negative' }),
    ])
  })
  test('keeps ambiguous numeric values unverified and omits an incomplete substance from automatic confirmation results', async () => {
    const document = await extractLabTest(
      pdf([
        [
          ...identity,
          ...headings(500),
          ...confirmation(475, 'Fentanyl', 'Negative'),
          ...confirmation(445, 'Norfentanyl', '<100 ng/mL'),
        ],
      ]),
    )
    expect(document).toMatchObject({
      hasConfirmation: true,
      confirmationComplete: false,
      resultsComplete: false,
      confirmationResults: [],
    })
    expect(document.confirmationAnalytes[1].result).toBeNull()
    expect(document.parseWarnings.length).toBeGreaterThan(0)
    expect(document.confidenceScore).toBeLessThan(85)
  })
  test('requires review for conflicting duplicate analytes and contradictory summary concentrations', async () => {
    const duplicate = await extractLabTest(
      pdf([
        [
          ...identity,
          ...headings(500),
          ...confirmation(475, 'Fentanyl', 'Negative'),
          ...confirmation(445, 'Fentanyl', 'Positive'),
        ],
      ]),
    )
    expect(duplicate).toMatchObject({ confirmationComplete: false, confirmationResults: [] })
    const contradictory = await extractLabTest(
      pdf([
        [
          ...identity,
          ...cells(660, [[195, 'Summary']]),
          ...cells(630, [[40, 'Fentanyl (2 ng/mL)']]),
          ...headings(500),
          ...confirmation(475, 'Fentanyl', 'Positive'),
        ],
      ]),
    )
    expect(contradictory).toMatchObject({ confirmationComplete: false, confirmationResults: [] })
  })
  test.each(['Unknown analyte', 'Methaqualone'])(
    'reports unmapped %s instead of silently declaring confirmation complete or using an unrelated drug class',
    async (analyte) => {
      const document = await extractLabTest(
        pdf([[...identity, ...headings(500), ...confirmation(475, analyte, 'Positive')]]),
      )
      expect(document).toMatchObject({
        reportKind: 'confirmation',
        hasConfirmation: true,
        confirmationComplete: false,
        confirmationResults: [],
      })
      expect(document.confirmationAnalytes[0]).toMatchObject({ substance: null, result: 'confirmed-positive' })
      expect(document.parseWarnings.length).toBeGreaterThan(0)
    },
  )
  test('retains the full panel when an EtG confirmation order is also printed', async () => {
    const document = await extractLabTest(
      pdf([
        [
          ...identity,
          ...cells(680, [[40, '049 - Ethyl Glucuronide LC/MS/MS']]),
          ...headings(500),
          ...screen(475),
          ...confirmation(240, 'EtG', '900 ng/mL', '500 ng/mL'),
        ],
      ]),
    )
    expect(document).toMatchObject({
      testType: '11-panel-lab',
      reportKind: 'screening-and-confirmation',
      resultRowCount: 10,
      confirmationComplete: true,
    })
  })
  test('does not confidently assume an 11-panel profile when the panel code is absent', async () => {
    const document = await extractLabTest(
      pdf([[...identity.filter((cell) => !cell.text.includes('B729')), ...headings(500), ...screen(475)]]),
    )
    expect(document).toMatchObject({ resultsComplete: false, confidence: 'low', resultRowCount: 10 })
    expect(document.parseWarnings.some((warning) => warning.includes('panel code'))).toBe(true)
  })
  test('keeps summary-indicated confirmation unverified when its table is absent', async () => {
    const document = await extractLabTest(
      pdf([
        [
          ...identity,
          ...cells(660, [[195, 'Summary']]),
          ...cells(640, [[40, 'Confirmed Positive for the following drug(s):']]),
          ...headings(500),
          ...screen(475),
        ],
      ]),
    )
    expect(document).toMatchObject({
      reportKind: 'screening-and-confirmation',
      hasConfirmation: true,
      confirmationComplete: false,
      resultsComplete: false,
      confirmationResults: [],
    })
    expect(document.confidence).toBe('low')
  })
  test.each(['donor', 'collection'])(
    'rejects a multi-report PDF with a different %s instead of combining clinical results',
    async (field) => {
      const second = identity.map((cell) => ({
        ...cell,
        text:
          field === 'donor' && cell.text === 'Sample'
            ? 'Another'
            : field === 'collection' && cell.text === '11/19/2025'
              ? '11/20/2025'
              : cell.text,
      }))
      await expect(
        extractLabTest(
          pdf([
            [...identity, ...headings(500), ...screen(475)],
            [...second, ...headings(500), ...screen(475)],
          ]),
        ),
      ).rejects.toThrow(/multiple donors or collections/)
    },
  )
  test('groups individual benzodiazepine metabolites while preserving their own analyte values', async () => {
    const document = await extractLabTest(
      pdf([
        [
          ...identity,
          ...headings(500),
          ...confirmation(475, 'Alpha-hydroxyalprazolam', '20 ng/mL'),
          ...confirmation(445, 'Oxazepam', 'Negative'),
        ],
      ]),
    )
    expect(document).toMatchObject({ confirmationComplete: true, parseWarnings: [] })
    expect(document.confirmationResults).toEqual([
      expect.objectContaining({ substance: 'benzodiazepines', result: 'confirmed-positive' }),
    ])
    expect(document.confirmationAnalytes.map((analyte) => analyte.analyte)).toEqual([
      'Alpha-hydroxyalprazolam',
      'Oxazepam',
    ])
  })
  test('does not count duplicate screening rows as a complete panel', async () => {
    const document = await extractLabTest(
      pdf([
        [
          ...identity,
          ...headings(500),
          ...screen(475).filter((cell) => cell.text !== 'THC' && cell.y !== 277),
          ...cells(250, [
            [40, 'Fentanyl'],
            [236, 'EIA'],
            [276, '5 ng/mL'],
            [323, 'Negative'],
          ]),
        ],
      ]),
    )
    expect(document.resultsComplete).toBe(false)
    expect(document.resultRowCount).toBe(9)
    expect(document.detectedSubstances).toEqual(['fentanyl'])
    expect(document.parseWarnings.some((warning) => warning.includes('Conflicting'))).toBe(true)
  })
  test('joins wrapped analyte labels within the same row without including adjacent rows', () => {
    const positioned: PositionedTextLine[] = headings(500)
      .map((cell) => cell)
      .reduce((all, cell) => {
        let line = all.find((item) => item.y === cell.y)
        if (!line) {
          line = { page: 1, y: cell.y, text: '', items: [] }
          all.push(line)
        }
        line.items.push({ ...cell, width: 20, height: 10, page: 1 })
        return all
      }, [] as PositionedTextLine[])
    for (const row of [
      cells(475, [
        [40, 'Alpha hydroxy'],
        [401, 'LC/MS/MS'],
        [441, '5 ng/mL'],
        [488, 'Negative'],
      ]),
      cells(468, [[40, 'alprazolam']]),
      confirmation(445, 'Fentanyl', 'Positive'),
    ])
      positioned.push({
        page: 1,
        y: row[0].y,
        text: '',
        items: row.map((cell) => ({ ...cell, width: 20, height: 10, page: 1 })),
      })
    expect(extractLabTableRows(positioned).map((row) => row.label)).toEqual(['Alpha hydroxy alprazolam', 'Fentanyl'])
    expect(parseScreenRows([]).rows.size).toBe(0)
  })
})

describe('quantitative confirmation interpretation', () => {
  test.each([
    ['0 ng/mL', '5 ng/mL', 'confirmed-negative'],
    ['4.9 ng/mL', '5 ng/mL', 'confirmed-negative'],
    ['5 ng/mL', '5 ng/mL', 'confirmed-positive'],
    ['<5 ng/mL', '5 ng/mL', 'confirmed-negative'],
    ['<=5 ng/mL', '5 ng/mL', null],
    ['≤4 ng/mL', '5 ng/mL', 'confirmed-negative'],
    ['<100 ng/mL', '5 ng/mL', null],
    ['>5 ng/mL', '5 ng/mL', 'confirmed-positive'],
    ['>=4 ng/mL', '5 ng/mL', null],
    ['1,250 ng/mL', '5 ng/mL', 'confirmed-positive'],
    ['0.004 ug/mL', '5 ng/mL', 'confirmed-negative'],
    ['1 ng/mL', '0.005 ug/mL', 'confirmed-negative'],
    ['Positive', '5 ng/mL', 'confirmed-positive'],
    ['Not detected', '5 ng/mL', 'confirmed-negative'],
    ['Insufficient specimen', '5 ng/mL', 'inconclusive'],
    ['Not tested', '5 ng/mL', null],
    ['Positive Negative', '5 ng/mL', null],
    ['12 ng/mL', '', null],
    ['12', '5 ng/mL', null],
    ['12 ng/mL', '20 mg/dL', 'confirmed-negative'],
  ])('interprets %s against printed cutoff %s', (result, cutoff, expected) =>
    expect(interpretConfirmation(result, cutoff)).toBe(expected),
  )
  test('preserves numeric comparator and units independently of classification', () => {
    expect(parseLabMeasurement('≥ 1,250 µg/mL')).toMatchObject({ comparator: '>=', value: 1250, unit: 'ug/ml' })
  })
})

describe('qualitative confirmation summary reconciliation', () => {
  test.each([
    ['Positive', '<5 ng/mL'],
    ['Negative', '10 ng/mL'],
    ['Positive', 'Negative'],
  ])('requires review when a %s summary conflicts with %s in the table', async (summary, value) => {
    const result = await extractLabTest(
      pdf([
        [
          ...identity,
          ...cells(660, [[195, 'Summary']]),
          ...cells(640, [[40, `Confirmed ${summary} for the following drug(s):`]]),
          ...cells(620, [[40, 'Fentanyl']]),
          ...headings(500),
          ...confirmation(475, 'Fentanyl', value),
        ],
      ]),
    )
    expect(result.confirmationComplete).toBe(false)
    expect(result.resultsComplete).toBe(false)
    expect(result.confirmationResults).toEqual([])
    expect(result.confirmationSummarySubstances).toEqual(['fentanyl'])
    expect(result.parseWarnings.some((warning) => /summary.*table/i.test(warning))).toBe(true)
  })
  test('keeps consistent summary classifications and different metabolite outcomes usable', async () => {
    const result = await extractLabTest(
      pdf([
        [
          ...identity,
          ...cells(660, [[195, 'Summary']]),
          ...cells(640, [[40, 'Confirmed Positive for the following drug(s):']]),
          ...cells(620, [[40, 'Fentanyl']]),
          ...headings(500),
          ...confirmation(475, 'Fentanyl', '10 ng/mL'),
          ...confirmation(445, 'Norfentanyl', 'Negative'),
        ],
      ]),
    )
    expect(result.confirmationComplete).toBe(true)
    expect(result.confirmationResults[0].result).toBe('confirmed-positive')
    expect(result.parseWarnings).toEqual([])
  })
})

test('ends the confirmation summary before comparison notes and table headings', async () => {
  const result = await extractLabTest(
    pdf([
      [
        ...identity,
        ...cells(660, [[195, 'Summary']]),
        ...cells(640, [[40, 'Confirmed Positive for the following drug(s):']]),
        ...cells(620, [[40, 'THC-COOH (Marijuana) (937 ng/mL)']]),
        ...cells(600, [[40, 'THC-COOH/Creatinine Ratio (480 ng THC-COOH/mg Creat)']]),
        ...cells(580, [[40, 'Normalized THC-COOH value for comparison purposes only.']]),
        ...cells(560, [[40, 'See the Important Note and Comment below.']]),
        ...cells(540, [[40, 'Drug Tests']]),
        ...cells(520, [[40, 'SCREEN']]),
        ...headings(500),
        ...confirmation(475, 'THC-COOH', 'Confirmed Positive'),
      ],
    ]),
  )
  expect(result.confirmationComplete).toBe(true)
  expect(result.unmappedConfirmationLabels).toEqual([])
  expect(result.parseWarnings).toEqual([])
})
