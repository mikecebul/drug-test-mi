import { describe, expect, test } from 'vitest'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { extract15PanelInstant } from '../extract15PanelInstant'
import { getSubstanceOptions, type SubstanceValue } from '@/fields/substanceOptions'

// Fictional identity and reconstructed layout. Never commit the source client report.
const revisedPanel = [
  ['Methylenedioxymethamphetamine (MDMA) Ecstasy', '500', 'mdma'],
  ['Amphetamines', '500', 'amphetamines'],
  ['Methamphetamine 500', '500', 'methamphetamines'],
  ['Barbiturates', '200', 'barbiturates'],
  ['Benzodiazepines', '200', 'benzodiazepines'],
  ['Buprenorphine', '5', 'buprenorphine'],
  ['Cocaine', '150', 'cocaine'],
  ['EtG', '500', 'etg'],
  ['Fentanyl', '20', 'fentanyl'],
  ['Methadone', '300', 'methadone'],
  ['Tramadol', '200', 'tramadol'],
  ['Kratom (Mitragynine)', '250', 'kratom'],
  ['Opiates', '300', 'morphine'],
  ['Oxycodone', '100', 'oxycodone'],
  ['Phencyclidine (PCP)', '25', 'pcp'],
  ['Synthetic Cannabinoids', '25', 'synthetic_cannabinoids'],
  ['THC (Marijuana)', '50', 'thc'],
] as const

type Cell = { x: number; y: number; text: string }
const cells = (y: number, values: [number, string][]): Cell[] => values.map(([x, text]) => ({ x, y, text }))

// Draw in reverse order to exercise PDF.js coordinates rather than stream order.
function makePdf(pages: Cell[][]): Buffer {
  const objects = ['', '']
  const kids: number[] = []
  const fontId = 3 + pages.length * 2
  for (const page of pages) {
    const pageId = objects.length + 1
    kids.push(pageId)
    const stream = [...page]
      .reverse()
      .map(({ x, y, text }) => `BT /F1 8 Tf 1 0 0 1 ${x} ${y} Tm (${text.replace(/([\\()])/g, '\\$1')}) Tj ET`)
      .join('\n')
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${pageId + 1} 0 R >>`,
      `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    )
  }
  objects[0] = '<< /Type /Catalog /Pages 2 0 R >>'
  objects[1] = `<< /Type /Pages /Kids [${kids.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')
  let pdf = '%PDF-1.4\n'
  const offsets = [0]
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf))
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`
  })
  const xref = Buffer.byteLength(pdf)
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`)
    .join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(pdf)
}

function revisedPdf(
  positives: readonly SubstanceValue[] = [],
  omit?: SubstanceValue,
  title = '17 Drug Panel:AMP500,BAR200,BUP5,BZO200,COC150,ETG500,FTY20,K2',
) {
  return makePdf([
    [
      ...cells(770, [[40, 'Onsite Screening Device Report']]),
      ...cells(748, [
        [40, 'Donor Name:'],
        [160, 'Sample Q Donor'],
        [420, 'Specimen Type:'],
        [500, 'Urine'],
      ]),
      ...cells(727, [
        [40, 'Collected:'],
        [160, '10/21/202606:27 PM'],
      ]),
      ...cells(706, [
        [40, 'DOB:'],
        [160, '01/15/1990'],
      ]),
      ...cells(688, [
        [40, 'Sex:'],
        [160, 'M'],
      ]),
      ...cells(660, [[40, title]]),
      ...cells(647, [[40, '25,KRA250,MDMA500,MET500/mAMP500,MOP/OPI300,MTD300,OXY100,PCP25,THC']]),
      ...cells(634, [[40, '50,TRA200,SVT:OX,CR,pH,NI,SG']]),
      ...cells(608, [
        [40, 'Drug'],
        [310, 'Result'],
        [430, 'Method'],
        [480, 'Cutoff'],
      ]),
      ...revisedPanel
        .filter(([, , substance]) => substance !== omit)
        .flatMap(([label, cutoff, substance], index) =>
          cells(590 - index * 18, [
            [40, label],
            [310, positives.includes(substance) ? 'Presumptive Positive' : 'Negative'],
            [430, 'CIA'],
            [480, `${cutoff} ng/mL`],
          ]),
        ),
      ...cells(240, [[40, 'DISCLAIMER: The validity panel list is not a test result.']]),
    ],
    cells(700, [[40, 'Donor Signature']]),
  ])
}

describe('revised 17-panel instant report compatibility', () => {
  test.each([
    ['all negative', []],
    ['attached report result', ['buprenorphine']],
    [
      'renamed and lower-cutoff assays positive',
      ['methamphetamines', 'morphine', 'barbiturates', 'benzodiazepines', 'buprenorphine'],
    ],
    ['every assay positive', revisedPanel.map(([, , value]) => value)],
  ] as const)('reads %s without changing the existing panel category', async (_name, positives) => {
    const result = await extract15PanelInstant(revisedPdf(positives))
    expect(result).toMatchObject({
      testType: '17-panel-instant',
      donorName: 'Sample Q Donor',
      dob: '01/15/1990',
      gender: 'M',
      resultRowCount: 17,
      resultsComplete: true,
      confidence: 'high',
      parseWarnings: [],
      isDilute: false,
    })
    expect(new Date(result.collectionDate!).toISOString()).toBe('2026-10-21T22:27:00.000Z')
    expect(result.detectedSubstances.toSorted()).toEqual([...positives].toSorted())
    const options = new Set(getSubstanceOptions(result.testType).map(({ value }) => value))
    expect(result.detectedSubstances.every((value) => options.has(value))).toBe(true)
    expect(result.detectedSubstances).not.toContain('opiates')
    expect(result.extractedFields).not.toContain('isDilute')
  })

  test('validity panel names cannot fill a missing drug result', async () => {
    const result = await extract15PanelInstant(revisedPdf([], 'buprenorphine'))
    expect(result.resultRowCount).toBe(16)
    expect(result.resultsComplete).toBe(false)
    expect(result.confidence).not.toBe('high')
    expect(result.parseWarnings).not.toEqual([])
  })

  test('keeps the old 17-panel wording and Morphine result compatible', async () => {
    const result = await extract15PanelInstant(
      await readFile(path.join(__dirname, 'fixtures/17-panel-instant/pos-kratom-morphine.pdf')),
    )
    expect(result).toMatchObject({
      testType: '17-panel-instant',
      resultsComplete: true,
      resultRowCount: 17,
      parseWarnings: [],
    })
    expect(result.detectedSubstances.toSorted()).toEqual(['kratom', 'morphine'])
  })

  test('keeps Opiates as opiates on the older 15-panel reports', async () => {
    const result = await extract15PanelInstant(revisedPdf(['morphine'], undefined, 'iCup Urine 15 Panel'))
    expect(result.testType).toBe('15-panel-instant')
    expect(result.detectedSubstances).toEqual(['opiates'])
  })
})
