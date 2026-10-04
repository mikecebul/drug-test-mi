// Reproducible, fictional PDF reports with separate table cells. No production data.
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const fixtures = 'src/utilities/extractors/__tests__/fixtures'
const escape = (text) => text.replace(/([\\()])/g, '\\$1')

function writePdf(path, rows) {
  const stream = rows
    .flatMap((cells, index) =>
      cells.map(
        (text, col) =>
          `BT /F1 10 Tf 1 0 0 1 ${[40, 240, 345, 440][col]} ${750 - index * 22} Tm (${escape(text)}) Tj ET`,
      ),
    )
    .join('\n')
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  ]
  let pdf = '%PDF-1.4\n'
  const offsets = [0]
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf))
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`
  })
  const xref = Buffer.byteLength(pdf)
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  pdf += offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`)
    .join('')
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  const destination = resolve(root, path)
  mkdirSync(dirname(destination), { recursive: true })
  writeFileSync(destination, pdf)
}

const labSubstances = [
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
function lab(
  path,
  {
    code = 'B729 - Urine 11 Panel',
    donor = 'Sample Q Donor',
    collected = '11/19/2025 06:17 PM',
    positives = ['Buprenorphine'],
    substances = labSubstances,
    confirmations = [],
    creatinine = '105.9 mg/dL',
  } = {},
) {
  writePdf(path, [
    ['SYNTHETIC TEST REPORT'],
    [code],
    ['Identification:', donor],
    ['Collected:', collected],
    ...substances.map((substance) => [
      substance,
      substance === 'Alcohol (Ethanol)' ? 'EA' : 'EIA',
      '500 ng/mL',
      positives.includes(substance) ? 'Screened Positive' : 'Negative',
    ]),
    ['Creatinine', 'Colorimetric', '20 mg/dL', creatinine],
    ...confirmations.map(([substance, result]) => [substance, 'LC/MS/MS', '1 ng/mL', result]),
  ])
}
lab(`${fixtures}/11-panel-lab/screening.pdf`)
lab(`${fixtures}/11-panel-lab/confirmation.pdf`, {
  positives: ['Fentanyl'],
  confirmations: [
    ['Fentanyl', 'Negative'],
    ['Norfentanyl', 'Negative'],
  ],
})
lab(`${fixtures}/11-panel-lab/multi-positive.pdf`, { positives: ['EtG', 'THC'] })
lab(`${fixtures}/11-panel-lab/confirmed-positive.pdf`, {
  positives: ['THC'],
  confirmations: [['THC COOH', 'Confirmed Positive']],
})
lab(`${fixtures}/11-panel-lab/inconclusive.pdf`, {
  positives: ['Fentanyl'],
  confirmations: [['Fentanyl', 'Insufficient specimen']],
})
lab(`${fixtures}/11-panel-lab/incomplete.pdf`, { substances: labSubstances.slice(0, 9) })
lab(`${fixtures}/11-panel-lab/dilute.pdf`, { creatinine: '12 mg/dL' })
lab(`${fixtures}/11-panel-lab-no-etg/screening.pdf`, {
  code: 'B829 - Urine 11 Panel',
  substances: labSubstances.map((s) => (s === 'EtG' ? 'Alcohol (Ethanol)' : s)),
  positives: ['Alcohol (Ethanol)'],
})
lab(`${fixtures}/8-panel-lab/screening.pdf`, { code: 'B814 - Urine 8 Panel', substances: labSubstances.slice(0, 7) })
lab(`${fixtures}/17-panel-sos-lab/screening.pdf`, {
  code: 'B306 - Urine 17 Panel',
  substances: [...labSubstances, 'MDMA', 'Barbiturates', 'PCP', 'Oxycodone'],
  positives: ['MDMA', 'Barbiturates', 'PCP'],
})
lab(`${fixtures}/etg-lab/screening.pdf`, {
  code: '049 - Ethyl Glucuronide (EtG)',
  substances: ['EtG'],
  positives: ['EtG'],
})
lab('tests/e2e/fixtures/lab-screen.pdf', { donor: 'Test S Screening', collected: '01/07/2026 11:11 PM' })
lab('tests/e2e/fixtures/lab-confirmation.pdf', {
  donor: 'Test C Confirmation',
  collected: '10/03/2025 11:59 PM',
  positives: ['Fentanyl'],
  confirmations: [
    ['Fentanyl', 'Negative'],
    ['Norfentanyl', 'Negative'],
  ],
})

const instantSubstances = [
  '6-MAM',
  'Amphetamines',
  'Benzodiazepines',
  'Buprenorphine',
  'Cocaine',
  'EtG',
  'Fentanyl',
  'MDMA',
  'Methadone',
  'Methamphetamine',
  'Opiates',
  'Oxycodone',
  'Synthetic Cannabinoids',
  'THC',
  'Tramadol',
]
function instant(path, { substances = instantSubstances, positives = ['Buprenorphine'] } = {}) {
  writePdf(path, [
    ['SYNTHETIC TEST REPORT'],
    [substances.length === 17 ? 'FFUO - 17 Panel Slim Cup' : 'iCup Urine 15 Panel'],
    ['Donor Name:', 'Sample Q Donor'],
    ['Collected:', '11/20/2025 06:27 PM'],
    ['DOB:', '01/15/1990'],
    ['Sex:', 'M'],
    ...substances.map((substance) => [
      substance,
      positives.includes(substance) ? 'Presumptive Positive' : 'Negative',
      'CIA',
    ]),
  ])
}
instant(`${fixtures}/15-panel-instant/screening.pdf`)
instant(`${fixtures}/17-panel-instant/multi-positive.pdf`, {
  substances: [...instantSubstances, 'Kratom', 'PCP'],
  positives: ['THC', 'EtG'],
})
