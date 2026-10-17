import { FULL_NAME_PATTERN, normalizeExtractedDonorName } from '../donorName'
import { normalizeSubstanceLabel, type PositionedPdfText } from '../pdfText'
import {
  extractReportTableRows,
  readReportField,
  reportBodyLines,
  supportedAssayMethod,
  derivedReportRow,
  type ReportTableRow,
} from '../reportLayout'
import { parseReportCollectionTime, validReportDate } from '../reportDate'
import { readReportValidity, type SpecimenValidityStatus } from '../reportValidity'
import { panel15InstantSubstances, panel17InstantSubstances, type SubstanceValue } from '@/fields/substanceOptions'

export interface InstantScreeningRow {
  label: string
  substance: SubstanceValue | null
  result: 'negative' | 'positive' | null
  method: string
  cutoffText: string
  source: { page: number; bounds: ReportTableRow['resultBounds']; layout: ReportTableRow['layout'] }
}
export interface Extracted15PanelData {
  testType: '15-panel-instant' | '17-panel-instant'
  donorName: string | null
  collectionDate: string | null
  dob: string | null
  gender: string | null
  detectedSubstances: SubstanceValue[]
  isDilute: boolean
  rawText: string
  confidence: 'high' | 'medium' | 'low'
  confidenceScore: number
  confidenceReasons: string[]
  parseWarnings: string[]
  resultRowCount: number
  resultsComplete: boolean
  extractedFields: string[]
  screeningRows: InstantScreeningRow[]
  identityAnchored: boolean
  collectionTimeAnchored: boolean
  profileIdentified: boolean
  specimenValidityStatus: SpecimenValidityStatus
}
const ALIASES: Array<{ aliases: string[]; value: SubstanceValue }> = [
  { aliases: ['6 monoacetylmorphine', '6 mam'], value: '6-mam' },
  { aliases: ['methylenedioxymethamphetamine', 'mdma'], value: 'mdma' },
  { aliases: ['methamphetamine'], value: 'methamphetamines' },
  { aliases: ['amphetamines'], value: 'amphetamines' },
  { aliases: ['benzodiazepines'], value: 'benzodiazepines' },
  { aliases: ['buprenorphine'], value: 'buprenorphine' },
  { aliases: ['barbiturates'], value: 'barbiturates' },
  { aliases: ['cocaine'], value: 'cocaine' },
  { aliases: ['etg', 'ethyl glucuronide'], value: 'etg' },
  { aliases: ['fentanyl'], value: 'fentanyl' },
  { aliases: ['kratom', 'mitragynine'], value: 'kratom' },
  { aliases: ['methadone'], value: 'methadone' },
  { aliases: ['morphine'], value: 'morphine' },
  { aliases: ['opiates'], value: 'opiates' },
  { aliases: ['oxycodone'], value: 'oxycodone' },
  { aliases: ['phencyclidine', 'pcp'], value: 'pcp' },
  { aliases: ['synthetic cannabinoids'], value: 'synthetic_cannabinoids' },
  { aliases: ['thc', 'marijuana'], value: 'thc' },
  { aliases: ['tramadol'], value: 'tramadol' },
]
function mapSubstance(label: string): SubstanceValue | null {
  const normalized = normalizeSubstanceLabel(label).replace(/\s/g, '')
  return (
    ALIASES.find(({ aliases }) =>
      aliases.some((alias) => {
        const token = alias.replace(/\s/g, '')
        return normalized === token || normalized === token + 'ecstasy'
      }),
    )?.value ?? null
  )
}
const status = (value: string): InstantScreeningRow['result'] =>
  /^(?:Negative|NEG|Not Detected)$/i.test(value.trim())
    ? 'negative'
    : /^(?:Presumptive\s*Positive|Screened\s*Positive|Positive|POS)$/i.test(value.trim())
      ? 'positive'
      : null

// Retained only for older unlabeled donor headers. Such results require review
// in the shared parser assessment and cannot qualify for automatic application.
export function extractInstantDonorName(text: string): string | null {
  const strategies = [
    new RegExp(String.raw`Phone:\s*\(\d{3}\)\d{3}-\d{4}\s*\n\s*(${FULL_NAME_PATTERN})`, 'iu'),
    new RegExp(String.raw`(${FULL_NAME_PATTERN})\s*\n\s*iCup\s+Urine`, 'iu'),
    new RegExp(String.raw`(${FULL_NAME_PATTERN})\s*\n\s*FFUO\s+-\s+17\s+Panel\s+Slim\s+Cup`, 'iu'),
    new RegExp(String.raw`Donor Signature\s*\n\s*(${FULL_NAME_PATTERN})`, 'iu'),
  ]
  for (const pattern of strategies) {
    const match = text.match(pattern)
    if (match?.[1]) return normalizeExtractedDonorName(match[1])
  }
  return null
}

export function parseInstantReport(
  document: PositionedPdfText,
  tableRows = extractReportTableRows(document.lines),
): Extracted15PanelData {
  const body = reportBodyLines(document.lines),
    bodyText = body.map((line) => line.text).join('\n')
  const marker17 = /\b17\s+Panel\s+Slim\s+Cup\b/i.test(bodyText),
    marker15 = /\biCup\s+Urine\b|\b15\s*[- ]?\s*Panel\s+Instant\b/i.test(bodyText)
  if (marker17 && marker15)
    throw new Error('This PDF contains multiple instant panel profiles. Upload one report at a time.')
  const testType = marker17 ? '17-panel-instant' : '15-panel-instant'
  const expected = new Set<SubstanceValue>(
    (marker17 ? panel17InstantSubstances : panel15InstantSubstances).map((option) => option.value),
  )
  const donor = readReportField(document.lines, /^Donor Name:$/i),
    collected = readReportField(document.lines, /^Collected:$/i)
  const parsedDate = collected ? parseReportCollectionTime(collected) : null
  const dobText = readReportField(document.lines, /^(?:DOB|Date of Birth):$/i),
    genderText = readReportField(document.lines, /^(?:Sex|Gender):$/i)
  const donorName = donor ? normalizeExtractedDonorName(donor) : extractInstantDonorName(bodyText)
  const dob = dobText && validReportDate(dobText) ? dobText : null,
    gender = genderText && /^[MF]$/i.test(genderText) ? genderText.toUpperCase() : null
  const screeningRows: InstantScreeningRow[] = tableRows
    .filter((row) => row.method === 'CIA' || (!supportedAssayMethod(row.method) && !derivedReportRow(row)))
    .map((row) => ({
      label: row.label,
      substance: mapSubstance(row.label),
      result: row.method === 'CIA' ? status(row.resultText) : null,
      method: row.method,
      cutoffText: row.cutoffText,
      source: { page: row.page, bounds: row.resultBounds, layout: row.layout },
    }))
  const known = new Map<SubstanceValue, 'negative' | 'positive'>(),
    conflicts = new Set<SubstanceValue>()
  for (const row of screeningRows) {
    if (!row.substance || !row.result) continue
    if (known.has(row.substance) && known.get(row.substance) !== row.result) conflicts.add(row.substance)
    if (row.result === 'positive' || !known.has(row.substance)) known.set(row.substance, row.result)
  }
  const missing = [...expected].filter((substance) => !known.has(substance)),
    unexpected = [...known.keys()].filter((substance) => !expected.has(substance))
  const unread = screeningRows.filter((row) => !row.substance || !row.result)
  const parseWarnings: string[] = []
  if (!marker17 && !marker15)
    parseWarnings.push('The instant panel profile could not be identified; verify the test type manually.')
  if (missing.length)
    parseWarnings.push(`Missing screening results for ${missing.join(', ')}; verify those results manually.`)
  if (unexpected.length)
    parseWarnings.push(`Results outside the reported panel: ${unexpected.join(', ')}; verify the test type.`)
  if (unread.length)
    parseWarnings.push(
      `${unread.length} screening row${unread.length === 1 ? '' : 's'} could not be interpreted; verify the PDF.`,
    )
  if (conflicts.size)
    parseWarnings.push(`Conflicting screening results for ${[...conflicts].join(', ')}; verify the PDF.`)
  if (!donorName) parseWarnings.push('Donor name could not be identified; verify the client manually.')
  if (!parsedDate) parseWarnings.push('The collection timestamp is missing or invalid; verify it manually.')
  if (dobText && !dob) parseWarnings.push('The donor date of birth is invalid; verify the client manually.')
  const validity = readReportValidity(document.lines, tableRows),
    dilute = validity.isDilute
  parseWarnings.push(...validity.warnings)
  const resultsComplete =
    (marker17 || marker15) &&
    missing.length === 0 &&
    unexpected.length === 0 &&
    unread.length === 0 &&
    conflicts.size === 0 &&
    validity.warnings.length === 0
  const resultRowCount = known.size
  let confidenceScore =
    10 +
    (donorName ? (donor ? 25 : 15) : 0) +
    (parsedDate ? 25 : 0) +
    (dob && gender ? 5 : 0) +
    (resultsComplete ? 35 : resultRowCount ? 15 : 0)
  if (parseWarnings.length) confidenceScore = Math.min(confidenceScore, 84)
  if (!marker17 && !marker15) confidenceScore = Math.min(confidenceScore, 55)
  const extractedFields = [
    'testType',
    ...(donorName ? ['donorName'] : []),
    ...(parsedDate ? ['collectionDate'] : []),
    ...(dob ? ['dob'] : []),
    ...(gender ? ['gender'] : []),
    ...(known.size ? ['detectedSubstances'] : []),
    ...(dilute ? ['isDilute'] : []),
  ]
  return {
    testType,
    donorName,
    collectionDate: parsedDate?.toISOString() ?? null,
    dob,
    gender,
    detectedSubstances: [...known].filter(([, value]) => value === 'positive').map(([substance]) => substance),
    isDilute: dilute,
    specimenValidityStatus: validity.status,
    rawText: document.rawText,
    confidence: confidenceScore >= 85 ? 'high' : confidenceScore >= 60 ? 'medium' : 'low',
    confidenceScore,
    confidenceReasons: [
      marker17 || marker15 ? 'instant panel profile identified' : 'instant panel profile requires review',
      `${resultRowCount} distinct screening substances read`,
      ...(resultsComplete ? ['all expected panel substances read'] : []),
    ],
    parseWarnings,
    resultRowCount,
    resultsComplete,
    extractedFields,
    screeningRows,
    identityAnchored: Boolean(donor),
    collectionTimeAnchored: Boolean(parsedDate),
    profileIdentified: marker17 || marker15,
  }
}
