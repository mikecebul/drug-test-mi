import type { SubstanceValue } from '@/fields/substanceOptions'
import { TZDate } from '@date-fns/tz'
import { ALL_CAPS_FULL_NAME_PATTERN, FULL_NAME_PATTERN, normalizeExtractedDonorName } from './donorName'
import {
  extractPositionedPdfText,
  findAnchoredLine,
  findAnchoredValue,
  normalizeSubstanceLabel,
  type PositionedTextLine,
} from './pdfText'

type LabTestType = '11-panel-lab' | '11-panel-lab-no-etg' | '8-panel-lab' | '17-panel-sos-lab' | 'etg-lab'
type ConfirmationResult = 'confirmed-positive' | 'confirmed-negative' | 'inconclusive'

export interface ExtractedLabData {
  donorName: string | null
  collectionDate: string | null
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
  testType: LabTestType
  hasConfirmation: boolean
  confirmationResults: Array<{
    substance: SubstanceValue
    result: ConfirmationResult
    notes?: string
  }>
}

const LAB_NAME_FALSE_POSITIVES = [
  'MI Drug Test',
  'Drug Test',
  'Collected by',
  'Tom Brooks',
  'SPECIMEN TYPE',
  'DRUG TEST',
  'MI DRUG',
  'SANTA ROSA',
  'DRUG CLASS',
  'EIA',
  'THC',
]

const LAB_SUBSTANCE_ALIASES: Array<{ aliases: string[]; value: SubstanceValue }> = [
  { aliases: ['thc cooh', 'thc', 'marijuana', 'cannabinoids'], value: 'thc' },
  { aliases: ['ethyl glucuronide', 'etg'], value: 'etg' },
  { aliases: ['alcohol ethanol', 'ethanol'], value: 'alcohol' },
  { aliases: ['methylenedioxymethamphetamine', 'mdma'], value: 'mdma' },
  { aliases: ['methamphetamine', 'amphetamine', 'amphetamines 500'], value: 'amphetamines' },
  { aliases: ['benzodiazepines'], value: 'benzodiazepines' },
  { aliases: ['norbuprenorphine', 'buprenorphine'], value: 'buprenorphine' },
  { aliases: ['benzoylecgonine', 'cocaine'], value: 'cocaine' },
  { aliases: ['norfentanyl', 'fentanyl'], value: 'fentanyl' },
  { aliases: ['mitragynine', 'kratom'], value: 'kratom' },
  { aliases: ['methadone metabolite', 'methadone', 'eddp'], value: 'methadone' },
  { aliases: ['oxycodone', 'noroxycodone', 'oxymorphone'], value: 'oxycodone' },
  { aliases: ['morphine', 'codeine', 'hydromorphone', 'hydrocodone', 'opiates'], value: 'opiates' },
  { aliases: ['phencyclidine', 'pcp'], value: 'pcp' },
  { aliases: ['barbiturates'], value: 'barbiturates' },
  { aliases: ['propoxyphene'], value: 'propoxyphene' },
  { aliases: ['methaqualone', 'tricyclic antidepressants'], value: 'tricyclic_antidepressants' },
]

const EXPECTED_SCREEN_ROWS: Record<LabTestType, number> = {
  '11-panel-lab': 10,
  '11-panel-lab-no-etg': 10,
  '8-panel-lab': 7,
  '17-panel-sos-lab': 14,
  'etg-lab': 1,
}

function isUsableLabDonorName(name: string): boolean {
  return (
    !LAB_NAME_FALSE_POSITIVES.some((falsePositive) => name.includes(falsePositive)) && name.split(/\s+/).length >= 2
  )
}

export function extractLabDonorName(text: string): string | null {
  const accessionMatch = text.match(new RegExp(String.raw`Accession #:[^]*?(${FULL_NAME_PATTERN})`, 'iu'))
  if (accessionMatch?.[1]) {
    const name = normalizeExtractedDonorName(accessionMatch[1])
    if (isUsableLabDonorName(name)) return name
  }

  const allCapsMatch = text.match(new RegExp(String.raw`\b(${ALL_CAPS_FULL_NAME_PATTERN})\b`))
  if (allCapsMatch?.[1]) {
    const name = normalizeExtractedDonorName(allCapsMatch[1])
    if (isUsableLabDonorName(name)) return name
  }

  return null
}

function detectLabTestType(text: string): LabTestType {
  if (/(049|050)\s*-?\s*(?:Ethyl Glucuronide|EtG)/i.test(text)) return 'etg-lab'
  if (/B829\s*-?/i.test(text)) return '11-panel-lab-no-etg'
  if (/B814\s*-?/i.test(text)) return '8-panel-lab'
  if (/B306\s*-?\s*Urine 17 Panel/i.test(text)) return '17-panel-sos-lab'
  return '11-panel-lab'
}

function mapLabSubstance(label: string): SubstanceValue | null {
  const normalized = normalizeSubstanceLabel(label)
  return LAB_SUBSTANCE_ALIASES.find(({ aliases }) => aliases.some((alias) => normalized.includes(alias)))?.value ?? null
}

interface PositionedResultRow {
  label: string
  resultText: string
  substance: SubstanceValue | null
}

function extractMethodRows(lines: PositionedTextLine[], methodPattern: RegExp): PositionedResultRow[] {
  const rows: PositionedResultRow[] = []

  for (const line of lines) {
    const methodIndex = line.items.findIndex((item) => methodPattern.test(item.text))
    if (methodIndex <= 0) continue

    const afterMethod = line.items.slice(methodIndex + 1)
    // Redwood tables place cutoff immediately after method and the result in the
    // following column. Requiring both excludes LC-MS/MS glossary/footer text.
    if (afterMethod.length < 2) continue

    const label = line.items
      .slice(0, methodIndex)
      .map((item) => item.text)
      .join(' ')
    const resultText = afterMethod
      .slice(1)
      .map((item) => item.text)
      .join(' ')
    rows.push({ label, resultText, substance: mapLabSubstance(label) })
  }

  return rows
}

function parseScreenRows(lines: PositionedTextLine[]) {
  const rows = new Map<SubstanceValue, 'negative' | 'positive'>()
  const methodRows = extractMethodRows(lines, /^EIA$/i)
  let parsedRowCount = 0

  for (const row of methodRows) {
    if (!row.substance) continue
    if (/screened positive|presumptive positive|\bpositive\b/i.test(row.resultText)) {
      parsedRowCount += 1
      rows.set(row.substance, 'positive')
    } else if (/negative|not detected/i.test(row.resultText)) {
      parsedRowCount += 1
      rows.set(row.substance, 'negative')
    }
  }

  return { rows, methodRows, parsedRowCount }
}

function parseConfirmationResult(value: string): ConfirmationResult | null {
  if (/confirmed positive|\bpositive\b/i.test(value)) return 'confirmed-positive'
  if (/negative|not detected/i.test(value)) return 'confirmed-negative'
  if (/inconclusive|invalid|insufficient|unable|cancelled|canceled/i.test(value)) return 'inconclusive'
  if (/^\s*[<>]?\d+(?:\.\d+)?(?:\s*ng\/mL)?\s*$/i.test(value)) return 'confirmed-positive'
  return null
}

function parseConfirmationRows(lines: PositionedTextLine[]) {
  const methodRows = extractMethodRows(lines, /^LC\s*\/\s*MS\s*\/\s*MS$/i)
  const grouped = new Map<SubstanceValue, Array<{ result: ConfirmationResult; note: string }>>()
  let parsedRowCount = 0

  for (const row of methodRows) {
    if (!row.substance) continue
    const parsedResult = parseConfirmationResult(row.resultText)
    if (!parsedResult) continue

    parsedRowCount += 1
    const existing = grouped.get(row.substance) ?? []
    existing.push({ result: parsedResult, note: row.resultText })
    grouped.set(row.substance, existing)
  }

  const confirmationResults = [...grouped.entries()].map(([substance, results]) => {
    const result = results.some((entry) => entry.result === 'confirmed-positive')
      ? ('confirmed-positive' as const)
      : results.some((entry) => entry.result === 'inconclusive')
        ? ('inconclusive' as const)
        : ('confirmed-negative' as const)
    const notes = [...new Set(results.map((entry) => entry.note))].join('; ')
    return { substance, result, notes }
  })

  return { confirmationResults, methodRows, parsedRowCount }
}

function calculateLabConfidence(args: {
  donorName: string | null
  donorNameAnchored: boolean
  collectionDate: string | null
  resultRowCount: number
  resultsComplete: boolean
  confirmationRowCount: number
}) {
  let score = 10
  const reasons = ['test type identified']

  if (args.donorName) {
    score += args.donorNameAnchored ? 25 : 15
    reasons.push(
      args.donorNameAnchored ? 'donor name anchored to Identification' : 'donor name identified by layout fallback',
    )
  }
  if (args.collectionDate) {
    score += 25
    reasons.push('collection timestamp anchored to Collected')
  }
  if (args.resultsComplete) {
    score += 30
    reasons.push(`${args.resultRowCount} screening rows matched by method and coordinates`)
  } else if (args.resultRowCount > 0) {
    score += 15
    reasons.push(`only ${args.resultRowCount} screening rows matched by method and coordinates`)
  }
  if (args.confirmationRowCount > 0) {
    score += 5
    reasons.push(`${args.confirmationRowCount} confirmation analyte rows matched by coordinates`)
  }

  return {
    confidenceScore: Math.min(score, 100),
    confidence: score >= 85 ? ('high' as const) : score >= 60 ? ('medium' as const) : ('low' as const),
    confidenceReasons: reasons,
  }
}

export async function extractLabTest(buffer: Buffer): Promise<ExtractedLabData> {
  try {
    const document = await extractPositionedPdfText(buffer)
    const text = document.rawText
    const testType = detectLabTestType(text)
    const expectedRowCount = EXPECTED_SCREEN_ROWS[testType]
    const anchoredDonorName = findAnchoredValue(document.lines, /^Identification:$/i)
    const donorName = anchoredDonorName ? normalizeExtractedDonorName(anchoredDonorName) : extractLabDonorName(text)

    const collectedLine = findAnchoredLine(document.lines, /^Collected:$/i)
    const collectedLabelIndex = collectedLine?.items.findIndex((item) => /^Collected:$/i.test(item.text)) ?? -1
    const collectedText = collectedLine?.items
      .slice(collectedLabelIndex + 1)
      .map((item) => item.text)
      .join(' ')
    const collectedMatch = collectedText?.match(/(\d{1,2}\/\d{1,2}\/\d{4}).*?(\d{1,2}:\d{2}\s*(?:AM|PM))/i)
    const collectionDate = collectedMatch
      ? (parseDateTimeInEST(collectedMatch[1], collectedMatch[2])?.toISOString() ?? null)
      : null

    const screenData = parseScreenRows(document.lines)
    const confirmationData = parseConfirmationRows(document.lines)
    const resultRowCount = screenData.parsedRowCount
    const resultsComplete = resultRowCount >= expectedRowCount
    const detectedSubstances = [...screenData.rows.entries()]
      .filter(([, status]) => status === 'positive')
      .map(([substance]) => substance)
    const parseWarnings: string[] = []

    if (!resultsComplete) {
      parseWarnings.push(
        `Only ${resultRowCount} of ${expectedRowCount} expected screening rows were identified; verify every result manually.`,
      )
    }

    const unmappedConfirmationRows = confirmationData.methodRows.filter((row) => !row.substance).length
    if (unmappedConfirmationRows > 0) {
      parseWarnings.push(
        `${unmappedConfirmationRows} LC-MS/MS analyte row${unmappedConfirmationRows === 1 ? '' : 's'} could not be mapped to a substance.`,
      )
    }
    const uninterpretedConfirmationRows = confirmationData.methodRows.length - confirmationData.parsedRowCount
    if (uninterpretedConfirmationRows > unmappedConfirmationRows) {
      const count = uninterpretedConfirmationRows - unmappedConfirmationRows
      parseWarnings.push(
        `${count} mapped LC-MS/MS analyte row${count === 1 ? '' : 's'} had an unrecognized result value.`,
      )
    }
    if (/Confirmed Positive for the following drug/i.test(text) && confirmationData.confirmationResults.length === 0) {
      parseWarnings.push('The report summary indicates a confirmed positive, but no confirmation row could be parsed.')
    }

    const confidence = calculateLabConfidence({
      donorName,
      donorNameAnchored: Boolean(anchoredDonorName),
      collectionDate,
      resultRowCount,
      resultsComplete,
      confirmationRowCount: confirmationData.methodRows.length,
    })
    if (parseWarnings.some((warning) => /confirmed positive/i.test(warning))) {
      confidence.confidenceScore = Math.min(confidence.confidenceScore, 55)
      confidence.confidence = 'low'
    } else if (uninterpretedConfirmationRows > 0) {
      confidence.confidenceScore = Math.min(confidence.confidenceScore, 84)
      confidence.confidence = 'medium'
    }

    const isDilute = /\b(?:specimen is dilute|dilute specimen)\b/i.test(text)
    const extractedFields: string[] = ['testType']
    if (donorName) extractedFields.push('donorName')
    if (collectionDate) extractedFields.push('collectionDate')
    if (screenData.rows.size > 0) extractedFields.push('detectedSubstances')
    if (isDilute) extractedFields.push('isDilute')
    if (confirmationData.confirmationResults.length > 0) extractedFields.push('confirmationResults')

    return {
      donorName,
      collectionDate,
      detectedSubstances,
      isDilute,
      rawText: text,
      confidence: confidence.confidence,
      confidenceScore: confidence.confidenceScore,
      confidenceReasons: confidence.confidenceReasons,
      parseWarnings,
      resultRowCount,
      resultsComplete,
      extractedFields,
      testType,
      hasConfirmation: confirmationData.confirmationResults.length > 0,
      confirmationResults: confirmationData.confirmationResults,
    }
  } catch (error) {
    throw new Error(`Failed to extract lab test data: ${error instanceof Error ? error.message : String(error)}`)
  }
}

function parseDateTimeInEST(dateStr: string, timeStr: string): Date | null {
  try {
    const [monthStr, dayStr, yearStr] = dateStr.split('/')
    const year = parseInt(yearStr, 10)
    const month = parseInt(monthStr, 10) - 1
    const day = parseInt(dayStr, 10)
    const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i)
    if (!timeMatch) return null

    let hours = parseInt(timeMatch[1], 10)
    const minutes = parseInt(timeMatch[2], 10)
    const isPM = timeMatch[3].toUpperCase() === 'PM'
    if (isPM && hours !== 12) hours += 12
    else if (!isPM && hours === 12) hours = 0

    return new TZDate(year, month, day, hours, minutes, 0, 'America/New_York')
  } catch {
    return null
  }
}
