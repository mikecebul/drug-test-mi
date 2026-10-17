import { afterEach, describe, expect, test, vi } from 'vitest'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import * as pdfText from './pdfText'
import { parseDrugTestReport, assertReportParsedWithoutReview, MAX_REPORT_BYTES } from './parseDrugTestReport'
import { extract15PanelInstant } from './extract15PanelInstant'
import { extractLabTest } from './extractLabTest'
import { parseReportCollectionTime, validReportDate } from './reportDate'
import { makeReportPdf, type Cell } from './__tests__/helpers/reportPdf'
import { panel15InstantSubstances, panel17InstantSubstances } from '@/fields/substanceOptions'

const cell = (y: number, values: [number, string][]): Cell[] => values.map(([x, text]) => ({ x, y, text }))
const identity = (title = 'iCup Urine 15 Panel', date = '11/20/2025', dob = '01/15/1990') => [
  ...cell(770, [[40, title]]),
  ...cell(748, [
    [40, 'Donor'],
    [70, 'Name:'],
    [160, 'Sample'],
    [200, 'Q'],
    [213, 'Donor'],
    [430, 'Client:'],
    [480, 'Test clinic'],
  ]),
  ...cell(727, [
    [40, 'Collected:'],
    [160, date],
    [230, '06:27'],
    [260, 'PM'],
  ]),
  ...cell(706, [
    [40, 'DOB:'],
    [160, dob],
  ]),
  ...cell(688, [
    [40, 'Sex:'],
    [160, 'M'],
  ]),
]
const headings = (y = 655, order: 'default' | 'method-first' = 'default') =>
  cell(
    y,
    order === 'default'
      ? [
          [40, 'Drug'],
          [280, 'Result'],
          [400, 'Method'],
          [470, 'Cutoff'],
        ]
      : [
          [40, 'Drug'],
          [280, 'Method'],
          [350, 'Cutoff'],
          [470, 'Result'],
        ],
  )
const names15 = panel15InstantSubstances.map((option) => option.label),
  names17 = panel17InstantSubstances.map((option) => option.label)
const data = (
  names: string[],
  start = 630,
  statusFor: (name: string) => string = () => 'Negative',
  order: 'default' | 'method-first' = 'default',
) =>
  names.flatMap((name, index) =>
    cell(
      start - index * 18,
      order === 'default'
        ? [
            [40, name],
            [280, statusFor(name)],
            [400, 'CIA'],
            [470, '500 ng/mL'],
          ]
        : [
            [40, name],
            [280, 'CIA'],
            [350, '500 ng/mL'],
            [470, statusFor(name)],
          ],
    ),
  )
const instantPdf = (
  names: string[] = names15,
  statusFor: (name: string) => string = () => 'Negative',
  order: 'default' | 'method-first' = 'default',
) =>
  makeReportPdf([
    [
      ...identity(names === names17 ? 'FFUO - 17 Panel Slim Cup' : 'iCup Urine 15 Panel'),
      ...headings(655, order),
      ...data(names, 630, statusFor, order),
    ],
  ])
afterEach(() => vi.restoreAllMocks())

describe('single PDF.js parsing pipeline', () => {
  test.each(['default', 'method-first'] as const)(
    'reads every instant substance and positive with %s header order',
    async (order) => {
      const result = await parseDrugTestReport(
        instantPdf(names17, (name) => (name.startsWith('THC') ? 'Presumptive Positive' : 'Negative'), order),
      )
      expect(result).toMatchObject({
        reportFamily: 'instant',
        testType: '17-panel-instant',
        resultsComplete: true,
        resultRowCount: 17,
        requiresReview: false,
        reviewReasons: [],
        donorName: 'Sample Q Donor',
        dob: '01/15/1990',
        specimenValidityStatus: 'unreported',
      })
      expect(result.detectedSubstances).toEqual(['thc'])
      expect(() => assertReportParsedWithoutReview(result)).not.toThrow()
      if (result.reportFamily !== 'instant') throw new Error('Expected instant report')
      expect(result.screeningRows).toHaveLength(17)
      expect(result.screeningRows.every((row) => row.source.bounds && row.source.layout === 'headers')).toBe(true)
      expect(new Date(result.collectionDate!).toISOString()).toBe('2025-11-20T23:27:00.000Z')
    },
  )
  test('uses one PDF.js read for the entry point and each compatibility adapter', async () => {
    const reader = vi.spyOn(pdfText, 'extractPositionedPdfText')
    await parseDrugTestReport(instantPdf())
    expect(reader).toHaveBeenCalledTimes(1)
    reader.mockClear()
    await extract15PanelInstant(instantPdf())
    expect(reader).toHaveBeenCalledTimes(1)
    reader.mockClear()
    await extractLabTest(await readFile(path.join(__dirname, '__tests__/fixtures/11-panel-lab/screening.pdf')))
    expect(reader).toHaveBeenCalledTimes(1)
  })
  test.each(['11-panel-lab/screening.pdf', '11-panel-lab/confirmation.pdf', 'etg-lab/screening.pdf'])(
    'detects lab family through the same API for %s',
    async (file) => {
      const result = await parseDrugTestReport(await readFile(path.join(__dirname, '__tests__/fixtures', file)))
      expect(result.reportFamily).toBe('lab')
      expect(result.parserVersion).toBe('pdfjs-regions-v2')
      expect(result.resultsComplete).toBe(true)
    },
  )
  test('rejects a report uploaded to the wrong workflow', async () => {
    await expect(parseDrugTestReport(instantPdf(), 'lab')).rejects.toThrow(/instant report/)
    await expect(
      parseDrugTestReport(
        await readFile(path.join(__dirname, '__tests__/fixtures/11-panel-lab/screening.pdf')),
        'instant',
      ),
    ).rejects.toThrow(/lab report/)
  })
  test('rejects unsupported and mixed-family reports instead of guessing instant', async () => {
    await expect(parseDrugTestReport(makeReportPdf([[...cell(700, [[40, 'Unrelated invoice']])]]))).rejects.toThrow(
      /Unsupported PDF/,
    )
    await expect(
      parseDrugTestReport(
        makeReportPdf([
          [
            ...identity(),
            ...headings(),
            ...data(names15),
            ...cell(315, [
              [40, 'Fentanyl'],
              [280, 'Positive'],
              [400, 'EIA'],
              [470, '5 ng/mL'],
            ]),
          ],
        ]),
      ),
    ).rejects.toThrow(/mixed instant and lab/)
  })
  test('enforces the same report byte limit before reading any PDF', async () => {
    const reader = vi.spyOn(pdfText, 'extractPositionedPdfText')
    await expect(parseDrugTestReport(Buffer.alloc(MAX_REPORT_BYTES + 1))).rejects.toThrow(/10MB/)
    expect(reader).not.toHaveBeenCalled()
  })
})

describe('instant reliability safeguards', () => {
  test('checks expected substances rather than accepting the right number of rows', async () => {
    const wrongPanel = [...names15]
    wrongPanel[wrongPanel.length - 1] = 'THC (Marijuana)'
    const result = await parseDrugTestReport(instantPdf(wrongPanel))
    expect(result).toMatchObject({ resultsComplete: false, resultRowCount: 14, requiresReview: true })
    expect(result.reviewReasons).toContain('incomplete-or-ambiguous-results')
    expect(() => assertReportParsedWithoutReview(result)).toThrow()
  })
  test('keeps contradictory duplicate results for review and never erases a positive', async () => {
    const result = await parseDrugTestReport(
      makeReportPdf([
        [
          ...identity(),
          ...headings(),
          ...data(names15),
          ...cell(325, [
            [40, 'THC (Marijuana)'],
            [280, 'Positive'],
            [400, 'CIA'],
            [470, '50 ng/mL'],
          ]),
        ],
      ]),
    )
    expect(result).toMatchObject({ resultsComplete: false, requiresReview: true })
    expect(result.detectedSubstances).toContain('thc')
    expect(
      result.reportFamily === 'instant' &&
        result.screeningRows
          .filter((row) => row.substance === 'thc')
          .map((row) => row.result)
          .sort(),
    ).toEqual(['negative', 'positive'])
  })
  test.each(['Not tested', 'Positive Negative', 'Pending'])(
    'does not turn %s into a negative or ignore its row',
    async (value) => {
      const result = await parseDrugTestReport(
        instantPdf(names15, (name) => (name.startsWith('THC') ? value : 'Negative')),
      )
      expect(result).toMatchObject({ resultsComplete: false, requiresReview: true })
      expect(
        result.reportFamily === 'instant' && result.screeningRows.find((row) => row.substance === 'thc')?.result,
      ).toBeNull()
    },
  )
  test('does not map a control or unknown analyte to a known drug by substring', async () => {
    const result = await parseDrugTestReport(
      makeReportPdf([
        [
          ...identity(),
          ...headings(),
          ...data(names15),
          ...cell(325, [
            [40, 'Cocaine control'],
            [280, 'Positive'],
            [400, 'CIA'],
            [470, '500 ng/mL'],
          ]),
        ],
      ]),
    )
    expect(result).toMatchObject({ resultsComplete: false, requiresReview: true })
    expect(result.detectedSubstances).not.toContain('cocaine')
    expect(result.reportFamily === 'instant' && result.screeningRows.at(-1)?.substance).toBeNull()
  })
  test('supports split and wrapped labels, results and methods without creating a phantom row', async () => {
    const target = names17.findIndex((name) => name.startsWith('MDMA')),
      y = 630 - target * 18
    const rows = data(names17).filter((item) => item.y !== y)
    const result = await parseDrugTestReport(
      makeReportPdf([
        [
          ...identity('FFUO - 17 Panel Slim Cup'),
          ...headings(),
          ...rows,
          ...cell(y, [
            [40, 'Methylenedioxymethamphetamine (MDMA)'],
            [280, 'Presumptive'],
            [400, 'C'],
            [408, 'I'],
            [413, 'A'],
            [470, '500 ng/mL'],
          ]),
          ...cell(y - 7, [
            [40, 'Ecstasy'],
            [280, 'Positive'],
          ]),
        ],
      ]),
    )
    expect(result).toMatchObject({
      resultsComplete: true,
      resultRowCount: 17,
      requiresReview: false,
      detectedSubstances: ['mdma'],
    })
    expect(result.reportFamily === 'instant' && result.screeningRows.length).toBe(17)
  })
  test('reads a panel across repeated page headings regardless of PDF draw order', async () => {
    const result = await parseDrugTestReport(
      makeReportPdf([
        [...identity('FFUO - 17 Panel Slim Cup'), ...headings(), ...data(names17.slice(0, 8))],
        [...headings(740), ...data(names17.slice(8), 714)],
      ]),
    )
    expect(result).toMatchObject({ resultsComplete: true, resultRowCount: 17, requiresReview: false })
    expect(result.reportFamily === 'instant' && new Set(result.screeningRows.map((row) => row.source.page)).size).toBe(
      2,
    )
  })
  test('keeps supported headerless reports available for human review but excludes them from automatic processing', async () => {
    const result = await parseDrugTestReport(
      await readFile(path.join(__dirname, '__tests__/fixtures/15-panel-instant/screening.pdf')),
    )
    expect(result).toMatchObject({ resultsComplete: true, requiresReview: true })
    expect(result.reviewReasons).toContain('inferred-table-layout')
    expect(() => assertReportParsedWithoutReview(result)).toThrow()
  })
  test('does not confidently infer a panel from result count alone', async () => {
    const result = await parseDrugTestReport(
      makeReportPdf([[...identity('Onsite results'), ...headings(), ...data(names15)]]),
    )
    expect(result).toMatchObject({ resultsComplete: false, requiresReview: true, confidence: 'low' })
  })
  test.each(['donor', 'collection', 'dob'])('rejects conflicting %s identity across instant pages', async (field) => {
    const second = identity(
      'iCup Urine 15 Panel',
      field === 'collection' ? '11/21/2025' : '11/20/2025',
      field === 'dob' ? '01/16/1990' : '01/15/1990',
    ).map((item) => ({ ...item, text: field === 'donor' && item.text === 'Sample' ? 'Another' : item.text }))
    await expect(
      parseDrugTestReport(
        makeReportPdf([
          [...identity(), ...headings(), ...data(names15)],
          [...second, ...headings(), ...data(names15)],
        ]),
      ),
    ).rejects.toThrow(/multiple donors or collections/)
  })
  test('does not replace a missing collection timestamp with a printed date', async () => {
    const rows = identity().filter((item) => item.y !== 727)
    const result = await parseDrugTestReport(
      makeReportPdf([
        [
          ...rows,
          ...cell(674, [
            [40, 'Printed:'],
            [160, '11/20/2025 06:27 PM'],
          ]),
          ...headings(),
          ...data(names15),
        ],
      ]),
    )
    expect(result).toMatchObject({ collectionDate: null, requiresReview: true })
    expect(result.reviewReasons).toContain('missing-or-invalid-collection-time')
  })
  test('flags a missing or unsupported method rather than omitting an extra result', async () => {
    const result = await parseDrugTestReport(
      makeReportPdf([
        [
          ...identity(),
          ...headings(),
          ...data(names15),
          ...cell(325, [
            [40, 'THC (Marijuana)'],
            [280, 'Positive'],
            [400, 'Unrecognized'],
            [470, '50 ng/mL'],
          ]),
        ],
      ]),
    )
    expect(result).toMatchObject({ resultsComplete: false, requiresReview: true })
    expect(result.reviewReasons).toContain('missing-or-unsupported-assay-method')
  })
})
describe('date and specimen-validity extraction', () => {
  test.each(['02/29/2025', '04/31/2026', '13/01/2026', '00/10/2026'])(
    'rejects impossible date %s rather than rolling it over',
    (value) => expect(validReportDate(value)).toBe(false),
  )
  test.each([
    '11/20/2025 00:30 PM',
    '11/20/2025 13:30 PM',
    '11/20/2025 06:99 PM',
    '03/08/2026 02:30 AM',
    '11/02/2025 01:30 AM',
  ])('requires review for invalid or ambiguous local timestamp %s', (value) =>
    expect(parseReportCollectionTime(value)).toBeNull(),
  )
  test('supports a real leap date and midnight', () =>
    expect(new Date(parseReportCollectionTime('02/29/2024 12:00 AM')!).toISOString()).toBe('2024-02-29T05:00:00.000Z'))
  test.each([
    ['12 mg/dL', true, false],
    ['144 mg/dL', false, false],
    ['<20 mg/dL', true, false],
    ['<=20 mg/dL', false, true],
    ['>19 mg/dL', false, true],
  ] as const)('reads instant SVT creatinine %s without guessing ambiguous bounds', async (value, dilute, review) => {
    const result = await parseDrugTestReport(
      makeReportPdf([
        [
          ...identity(),
          ...headings(),
          ...data(names15),
          ...cell(325, [[40, 'Specimen Validity Tests']]),
          ...cell(304, [
            [40, 'Test'],
            [240, 'Method'],
            [345, 'Reference Range'],
            [470, 'Result'],
          ]),
          ...cell(280, [
            [40, 'Creatinine'],
            [240, 'Colorimetric'],
            [345, '20 mg/dL'],
            [470, value],
          ]),
        ],
      ]),
    )
    expect(result).toMatchObject({
      isDilute: dilute,
      requiresReview: review,
      specimenValidityStatus: review ? 'unverified' : dilute ? 'dilute' : 'not-dilute',
    })
  })
  test('does not mistake glossary statements about dilution for a specimen result', async () => {
    const result = await parseDrugTestReport(
      makeReportPdf([
        [
          ...identity(),
          ...headings(),
          ...data(names15),
          ...cell(325, [[40, 'DISCLAIMER:']]),
          ...cell(306, [[40, 'If the specimen is dilute, follow the instructions.']]),
        ],
      ]),
    )
    expect(result).toMatchObject({ isDilute: false, specimenValidityStatus: 'unreported', requiresReview: false })
  })
  test('ignores a recognized derived ratio while retaining ordinary assay results', async () => {
    const result = await parseDrugTestReport(
      makeReportPdf([
        [
          ...identity(),
          ...headings(),
          ...data(names15),
          ...cell(325, [
            [40, 'THC-COOH/Creatinine Ratio'],
            [280, 'See Summary'],
            [400, 'Calculated'],
            [470, '0'],
          ]),
        ],
      ]),
    )
    expect(result).toMatchObject({ resultsComplete: true, requiresReview: false, resultRowCount: 15 })
  })
})
