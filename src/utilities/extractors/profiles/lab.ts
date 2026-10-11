import { readReportValidity, type SpecimenValidityStatus } from '../reportValidity'
export { parseCreatinineResult } from '../reportValidity'
import { getSubstanceOptions } from '@/fields/substanceOptions'
import { extractReportTableRows, type ReportTableRow } from '../reportLayout'
import { parseReportCollectionTime, validReportDate } from '../reportDate'
import type { SubstanceValue } from '@/fields/substanceOptions'
import { ALL_CAPS_FULL_NAME_PATTERN, FULL_NAME_PATTERN, normalizeExtractedDonorName } from '../donorName'
import { normalizeSubstanceLabel, type PositionedTextLine, type PositionedPdfText } from '../pdfText'
import { labSummaryLines, readLabField, type LabTableRow } from '../labReportLayout'
import {
  interpretConfirmation,
  parseLabMeasurement,
  type ConfirmationResult,
  type LabMeasurement,
} from '../labConfirmation'

type LabTestType = '11-panel-lab' | '11-panel-lab-no-etg' | '8-panel-lab' | '17-panel-sos-lab' | 'etg-lab'
export interface LabConfirmationAnalyte {
  analyte: string
  substance: SubstanceValue | null
  method: string
  cutoff: LabMeasurement | null
  resultText: string
  result: ConfirmationResult | null
  measured: LabMeasurement | null
  source: { page: number; bounds: LabTableRow['resultBounds'] }
}

export interface ExtractedLabData {
  donorName: string | null
  identityAnchored: boolean
  collectionTimeAnchored: boolean
  profileIdentified: boolean
  collectionDate: string | null
  detectedSubstances: SubstanceValue[]
  isDilute: boolean
  specimenValidityStatus: SpecimenValidityStatus
  rawText: string
  confidence: 'high' | 'medium' | 'low'
  confidenceScore: number
  confidenceReasons: string[]
  parseWarnings: string[]
  resultRowCount: number
  resultsComplete: boolean
  extractedFields: string[]
  testType: LabTestType
  reportKind: 'screening' | 'confirmation' | 'screening-and-confirmation' | 'unknown'
  dob: string | null
  hasScreening: boolean
  screeningComplete: boolean
  hasConfirmation: boolean
  confirmationComplete: boolean
  confirmationSummarySubstances: SubstanceValue[]
  unmappedConfirmationLabels: string[]
  confirmationAnalytes: LabConfirmationAnalyte[]
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
  { aliases: ['alcohol ethanol', 'alcohol', 'ethanol'], value: 'alcohol' },
  { aliases: ['methylenedioxymethamphetamine', 'mdma'], value: 'mdma' },
  { aliases: ['methamphetamine', 'amphetamine', 'amphetamines', 'amphetamines 500'], value: 'amphetamines' },
  {
    aliases: [
      'benzodiazepines',
      'alpha hydroxyalprazolam',
      'alpha hydroxytriazolam',
      '7 aminoclonazepam',
      'oxazepam',
      'temazepam',
      'nordiazepam',
      'lorazepam',
    ],
    value: 'benzodiazepines',
  },
  { aliases: ['norbuprenorphine', 'buprenorphine'], value: 'buprenorphine' },
  { aliases: ['benzoylecgonine', 'cocaine'], value: 'cocaine' },
  { aliases: ['norfentanyl', 'fentanyl', 'fentanyls'], value: 'fentanyl' },
  { aliases: ['mitragynine', 'kratom'], value: 'kratom' },
  { aliases: ['methadone metabolite', 'methadone', 'eddp'], value: 'methadone' },
  { aliases: ['oxycodone', 'noroxycodone', 'oxymorphone'], value: 'oxycodone' },
  { aliases: ['morphine', 'codeine', 'hydromorphone', 'hydrocodone', 'opiates'], value: 'opiates' },
  { aliases: ['phencyclidine', 'pcp'], value: 'pcp' },
  { aliases: ['barbiturates'], value: 'barbiturates' },
  { aliases: ['propoxyphene'], value: 'propoxyphene' },
  { aliases: ['tricyclic antidepressants'], value: 'tricyclic_antidepressants' },
]

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
  if (/B829\s*-?/i.test(text)) return '11-panel-lab-no-etg'
  if (/B814\s*-?/i.test(text)) return '8-panel-lab'
  if (/\bB306\b/i.test(text)) return '17-panel-sos-lab'
  // An EtG confirmation order can accompany a full panel. Keep that panel's
  // identity rather than treating its add-on confirmation as an EtG-only test.
  if (/\bB729\b/i.test(text)) return '11-panel-lab'
  if (/\b(?:049|050)\b\s*-?\s*(?:Ethyl Glucuronide|EtG)/i.test(text)) return 'etg-lab'
  return '11-panel-lab'
}

function mapLabSubstance(label: string): SubstanceValue | null {
  const normalized = normalizeSubstanceLabel(label)
  return (
    LAB_SUBSTANCE_ALIASES.find(({ aliases }) =>
      aliases.some((alias) => normalized.replace(/\s/g, '') === alias.replace(/\s/g, '')),
    )?.value ?? null
  )
}

interface PositionedResultRow {
  label: string
  resultText: string
  substance: SubstanceValue | null
  cutoffText: string
  source: LabTableRow
}

function extractMethodRows(
  lines: PositionedTextLine[],
  methodPattern: RegExp,
  tableRows = extractReportTableRows(lines),
): PositionedResultRow[] {
  const rows: PositionedResultRow[] = []

  for (const source of tableRows) {
    if (!methodPattern.test(source.method)) continue
    rows.push({
      label: source.label,
      resultText: source.resultText,
      cutoffText: source.cutoffText,
      substance: mapLabSubstance(source.label),
      source,
    })
  }

  return rows
}

export function parseScreenRows(lines: PositionedTextLine[], tableRows = extractReportTableRows(lines)) {
  const rows = new Map<SubstanceValue, 'negative' | 'positive'>()
  // Redwood uses EA (Enzyme Assay) for the B829 Alcohol (Ethanol) row and
  // EIA for the remaining immunoassay rows.
  const methodRows = extractMethodRows(lines, /^(?:EA|EIA)$/i, tableRows)
  let parsedRowCount = 0
  const conflicts = new Set<SubstanceValue>()

  for (const row of methodRows) {
    if (!row.substance) continue
    if (/\bpositive\b/i.test(row.resultText) && /negative|not detected/i.test(row.resultText)) continue
    const status = /\bpositive\b/i.test(row.resultText)
      ? 'positive'
      : /negative|not detected/i.test(row.resultText)
        ? 'negative'
        : null
    if (status && rows.has(row.substance) && rows.get(row.substance) !== status) conflicts.add(row.substance)
    if (/screened positive|presumptive positive|\bpositive\b/i.test(row.resultText)) {
      parsedRowCount += 1
      rows.set(row.substance, 'positive')
    } else if (/negative|not detected/i.test(row.resultText)) {
      parsedRowCount += 1
      // A later negative duplicate must never erase an earlier positive screen.
      if (rows.get(row.substance) !== 'positive') rows.set(row.substance, 'negative')
    }
  }

  return { rows, methodRows, parsedRowCount, conflicts }
}

function readConfirmationSummary(lines: PositionedTextLine[]) {
  const entries: Array<{ label: string; substance: SubstanceValue | null; result: ConfirmationResult }> = []
  let result: ConfirmationResult | null = null
  for (const line of labSummaryLines(lines)) {
    const heading = line.text.match(/^Confirmed (Positive|Negative) for the following drug(?:\(s\)|s)?\s*:\s*(.*)$/i)
    let text = line.text
    if (heading) {
      result = heading[1].toLowerCase() === 'positive' ? 'confirmed-positive' : 'confirmed-negative'
      text = heading[2]
    } else if (
      /^(?:Screened|Presumptive|Specimen|Comments?|Notes?|Normalized|See|Drug Tests?|SCREEN|CONFIRMATION|Tests Ordered)\b/i.test(
        text,
      ) ||
      /creatinine\s*ratio/i.test(text)
    ) {
      result = null
    }
    if (!result || !text.trim() || /creatinine\s*ratio/i.test(text)) continue
    for (const label of text
      .replace(/\([^)]*\)/g, '')
      .split(/[;,]/)
      .map((value) => value.trim())
      .filter(Boolean)) {
      entries.push({ label, substance: mapLabSubstance(label), result })
    }
  }
  return entries
}

function parseConfirmationRows(lines: PositionedTextLine[], tableRows = extractReportTableRows(lines)) {
  const methodRows = extractMethodRows(lines, /^(?:LC\s*[/-]\s*MS\s*[/-]\s*MS|GC\s*[/-]\s*MS)$/i, tableRows)
  const grouped = new Map<SubstanceValue, Array<{ result: ConfirmationResult; note: string }>>()
  const unresolved = new Set<SubstanceValue>()
  const confirmationAnalytes: LabConfirmationAnalyte[] = []
  const summary = labSummaryLines(lines)
  for (const row of methodRows) {
    const parsedResult = interpretConfirmation(row.resultText, row.cutoffText)
    // Quantitative values may appear only in the Summary while the table says
    // CONFIRMED POSITIVE. Match the individual analyte; never use a class-wide
    // number or the normalized creatinine ratio as its concentration.
    const summaryValue = summary
      .flatMap((line) => {
        const match = line.text.match(
          /^(.*?)\s*\(([<>≤≥]?\s*\d+(?:,\d{3})*(?:\.\d+)?\s*(?:[nuµμm]?g)\s*\/\s*mL)\)\s*$/i,
        )
        return match && normalizeSubstanceLabel(match[1]) === normalizeSubstanceLabel(row.label)
          ? [parseLabMeasurement(match[2])]
          : []
      })
      .filter((value): value is LabMeasurement => Boolean(value))
    const distinctValues = new Set(summaryValue.map((value) => `${value.comparator}:${value.value}:${value.unit}`))
    const measured = parseLabMeasurement(row.resultText) ?? (distinctValues.size === 1 ? summaryValue[0] : null)
    const contradictory =
      parsedResult &&
      measured &&
      interpretConfirmation(measured.text, row.cutoffText) &&
      interpretConfirmation(measured.text, row.cutoffText) !== parsedResult
    const result = distinctValues.size > 1 || contradictory ? null : parsedResult
    confirmationAnalytes.push({
      analyte: row.label,
      substance: row.substance,
      method: row.source.method,
      cutoff: parseLabMeasurement(row.cutoffText),
      resultText: row.resultText,
      result,
      measured,
      source: { page: row.source.page, bounds: row.source.resultBounds },
    })
    if (!row.substance) continue
    if (!result) {
      unresolved.add(row.substance)
      continue
    }

    const existing = grouped.get(row.substance) ?? []
    existing.push({
      result,
      note: `${row.label}: ${row.resultText}${measured && measured.text !== row.resultText ? `; ${measured.text}` : ''}${row.cutoffText ? ` (cutoff ${row.cutoffText})` : ''}`,
    })
    grouped.set(row.substance, existing)
  }

  for (const analyte of confirmationAnalytes) {
    const duplicates = confirmationAnalytes.filter(
      (other) => normalizeSubstanceLabel(other.analyte) === normalizeSubstanceLabel(analyte.analyte),
    )
    if (new Set(duplicates.map((other) => JSON.stringify([other.result, other.measured]))).size > 1) {
      duplicates.forEach((other) => {
        other.result = null
        if (other.substance) unresolved.add(other.substance)
      })
    }
  }

  const summaryEntries = readConfirmationSummary(lines)
  const summaryWarnings: string[] = []
  const unmappedConfirmationLabels = summaryEntries.filter((entry) => !entry.substance).map((entry) => entry.label)
  for (const entry of summaryEntries) {
    if (!entry.substance) continue
    const exact = confirmationAnalytes.filter(
      (analyte) => normalizeSubstanceLabel(analyte.analyte) === normalizeSubstanceLabel(entry.label),
    )
    const matching = exact.length
      ? exact
      : confirmationAnalytes.filter((analyte) => analyte.substance === entry.substance)
    const observed = matching.some((analyte) => analyte.result === 'confirmed-positive')
      ? 'confirmed-positive'
      : matching.length && matching.every((analyte) => analyte.result === 'confirmed-negative')
        ? 'confirmed-negative'
        : null
    if (observed !== entry.result) {
      unresolved.add(entry.substance)
      matching.forEach((analyte) => {
        analyte.result = null
      })
      summaryWarnings.push(`The confirmation summary and result table do not agree for ${entry.label}; verify the PDF.`)
    }
  }
  if (unmappedConfirmationLabels.length) {
    summaryWarnings.push('A confirmation in the report summary could not be mapped; verify the PDF.')
  }
  // A qualitative summary with no analyte list must still agree with the table.
  for (const result of ['confirmed-positive', 'confirmed-negative'] as const) {
    const word = result === 'confirmed-positive' ? 'Positive' : 'Negative'
    const hasStatement = summary.some((line) =>
      new RegExp(`Confirmed ${word} for the following drug`, 'i').test(line.text),
    )
    if (!hasStatement || summaryEntries.some((entry) => entry.result === result)) continue
    const agrees =
      result === 'confirmed-positive'
        ? confirmationAnalytes.some((analyte) => analyte.result === result)
        : confirmationAnalytes.length > 0 && confirmationAnalytes.every((analyte) => analyte.result === result)
    if (!agrees) {
      confirmationAnalytes.forEach((analyte) => {
        analyte.result = null
        if (analyte.substance) unresolved.add(analyte.substance)
      })
      if (!confirmationAnalytes.length) unmappedConfirmationLabels.push('Confirmation summary')
      summaryWarnings.push(
        `The report summary indicates a confirmed ${word.toLowerCase()}, but the confirmation table does not agree; verify the PDF.`,
      )
    }
  }

  const confirmationResults = [...grouped.entries()]
    .filter(([substance]) => !unresolved.has(substance))
    .map(([substance, results]) => {
      const result = results.some((entry) => entry.result === 'confirmed-positive')
        ? ('confirmed-positive' as const)
        : results.some((entry) => entry.result === 'inconclusive')
          ? ('inconclusive' as const)
          : ('confirmed-negative' as const)
      const notes = [...new Set(results.map((entry) => entry.note))].join('; ')
      return { substance, result, notes }
    })

  return {
    confirmationResults,
    confirmationAnalytes,
    methodRows,
    summaryWarnings,
    summarySubstances: [...new Set(summaryEntries.flatMap((entry) => (entry.substance ? [entry.substance] : [])))],
    unmappedConfirmationLabels: [...new Set(unmappedConfirmationLabels)],
    parsedRowCount: confirmationAnalytes.filter((analyte) => analyte.substance && analyte.result).length,
    complete:
      methodRows.length > 0 &&
      summaryWarnings.length === 0 &&
      confirmationAnalytes.every((analyte) => analyte.substance && analyte.result),
  }
}

export function calculateLabConfidence(args: {
  donorName: string | null
  donorNameAnchored: boolean
  collectionDate: string | null
  resultRowCount: number
  resultsComplete: boolean
  creatinineResultFound: boolean
  confirmationRowCount: number
  confirmationOnly?: boolean
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
    reasons.push(
      args.confirmationOnly
        ? `${args.confirmationRowCount} confirmation analytes matched by coordinates`
        : `${args.resultRowCount} screening rows matched by method and coordinates`,
    )
  } else if (args.resultRowCount > 0) {
    score += 15
    reasons.push(`only ${args.resultRowCount} screening rows matched by method and coordinates`)
  }
  if (args.creatinineResultFound) {
    score += 10
    reasons.push('creatinine specimen-validity row matched by method and coordinates')
  }
  if (args.confirmationRowCount > 0) {
    score += 5
    reasons.push(`${args.confirmationRowCount} confirmation analyte rows matched by coordinates`)
  }

  // A missing screening row always requires manual review, even when every
  // identity and specimen-validity field was extracted successfully.
  const confidenceScore = args.resultsComplete ? Math.min(score, 100) : Math.min(score, 84)

  return {
    confidenceScore,
    confidence:
      confidenceScore >= 85 ? ('high' as const) : confidenceScore >= 60 ? ('medium' as const) : ('low' as const),
    confidenceReasons: reasons,
  }
}

export function parseLabReport(
  document: PositionedPdfText,
  tableRows: ReportTableRow[] = extractReportTableRows(document.lines),
): ExtractedLabData {
  try {
    const text = document.rawText
    const testType = detectLabTestType(text)
    const knownPanel = /\b(?:B729|B829|B814|B306)\b|\b(?:049|050)\b\s*-?\s*(?:Ethyl Glucuronide|EtG)/i.test(text)

    const anchoredDonorName = readLabField(document.lines, /^(?:Identification|Donor Name):$/i)
    const donorName = anchoredDonorName ? normalizeExtractedDonorName(anchoredDonorName) : extractLabDonorName(text)

    const collectedText = readLabField(document.lines, /^Collected:$/i)
    const collectionDate = collectedText ? (parseReportCollectionTime(collectedText)?.toISOString() ?? null) : null

    const screenData = parseScreenRows(document.lines, tableRows)
    const validity = readReportValidity(document.lines, tableRows)
    const creatinineResult = validity.creatinine
    const confirmationData = parseConfirmationRows(document.lines, tableRows)
    const hasScreening = screenData.methodRows.length > 0
    const summaryHasConfirmation = labSummaryLines(document.lines).some((line) =>
      /Confirmed (?:Positive|Negative) for the following drug/i.test(line.text),
    )
    const hasConfirmation = confirmationData.methodRows.length > 0 || summaryHasConfirmation
    const reportKind = hasScreening
      ? hasConfirmation
        ? 'screening-and-confirmation'
        : 'screening'
      : hasConfirmation
        ? 'confirmation'
        : 'unknown'
    const expected = new Set(getSubstanceOptions(testType).map((option) => option.value))
    const missing = [...expected].filter((substance) => !screenData.rows.has(substance))
    const unexpected = [...screenData.rows.keys()].filter((substance) => !expected.has(substance))
    const resultRowCount = screenData.rows.size
    const screeningComplete =
      knownPanel &&
      hasScreening &&
      missing.length === 0 &&
      unexpected.length === 0 &&
      screenData.methodRows.length === screenData.parsedRowCount &&
      screenData.conflicts.size === 0
    const resultsComplete =
      knownPanel &&
      (hasScreening
        ? missing.length === 0 &&
          unexpected.length === 0 &&
          screenData.methodRows.length === screenData.parsedRowCount &&
          screenData.conflicts.size === 0 &&
          (!hasConfirmation || confirmationData.complete)
        : reportKind === 'confirmation' && confirmationData.complete)
    const detectedSubstances = [...screenData.rows.entries()]
      .filter(([, status]) => status === 'positive')
      .map(([substance]) => substance)
    const parseWarnings: string[] = [...validity.warnings, ...confirmationData.summaryWarnings]
    if (!knownPanel) parseWarnings.push('The panel code could not be identified; verify the test type manually.')

    if (hasScreening && missing.length > 0) {
      parseWarnings.push(`Missing screening results for ${missing.join(', ')}; verify every result manually.`)
    }
    if (hasScreening && unexpected.length)
      parseWarnings.push(`Results outside the reported panel: ${unexpected.join(', ')}; verify the test type.`)
    if (reportKind === 'unknown')
      parseWarnings.push('No supported screening or confirmation result table was identified.')
    const unreadScreenRows = screenData.methodRows.length - screenData.parsedRowCount
    if (unreadScreenRows > 0)
      parseWarnings.push(
        `${unreadScreenRows} screening row${unreadScreenRows === 1 ? '' : 's'} could not be interpreted; verify the PDF.`,
      )
    if (screenData.conflicts.size)
      parseWarnings.push(`Conflicting screening rows for ${[...screenData.conflicts].join(', ')}; verify the PDF.`)

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
    const positiveSummary = labSummaryLines(document.lines).some((line) =>
      /Confirmed Positive for the following drug/i.test(line.text),
    )
    if (positiveSummary && confirmationData.confirmationResults.length === 0) {
      parseWarnings.push('The report summary indicates a confirmed positive, but no confirmation row could be parsed.')
    }

    const confidence = calculateLabConfidence({
      donorName,
      donorNameAnchored: Boolean(anchoredDonorName),
      collectionDate,
      resultRowCount,
      resultsComplete,
      creatinineResultFound: Boolean(creatinineResult),
      confirmationRowCount: confirmationData.methodRows.length,
      confirmationOnly: reportKind === 'confirmation',
    })
    if (parseWarnings.some((warning) => /confirmed positive/i.test(warning))) {
      confidence.confidenceScore = Math.min(confidence.confidenceScore, 55)
      confidence.confidence = 'low'
    } else if (uninterpretedConfirmationRows > 0 || unreadScreenRows > 0 || screenData.conflicts.size > 0) {
      confidence.confidenceScore = Math.min(confidence.confidenceScore, 84)
      confidence.confidence = 'medium'
    }
    if (validity.warnings.length) {
      confidence.confidenceScore = Math.min(confidence.confidenceScore, 84)
      confidence.confidence = 'medium'
    }
    if (!knownPanel) {
      confidence.confidenceScore = Math.min(confidence.confidenceScore, 55)
      confidence.confidence = 'low'
    }

    const isDilute = validity.isDilute
    const extractedFields: string[] = ['testType']
    if (donorName) extractedFields.push('donorName')
    if (collectionDate) extractedFields.push('collectionDate')
    if (screenData.rows.size > 0) extractedFields.push('detectedSubstances')
    if (isDilute) extractedFields.push('isDilute')
    if (confirmationData.confirmationResults.length > 0) extractedFields.push('confirmationResults')
    const dobText = readLabField(document.lines, /^(?:DOB|Date of Birth):$/i)
    const dob = dobText && validReportDate(dobText) ? dobText : null
    if (dob) extractedFields.push('dob')

    return {
      donorName,
      identityAnchored: Boolean(anchoredDonorName),
      collectionTimeAnchored: Boolean(collectionDate),
      profileIdentified: knownPanel,
      collectionDate,
      detectedSubstances,
      isDilute,
      specimenValidityStatus: validity.status,
      rawText: text,
      confidence: confidence.confidence,
      confidenceScore: confidence.confidenceScore,
      confidenceReasons: confidence.confidenceReasons,
      parseWarnings,
      resultRowCount,
      resultsComplete,
      extractedFields,
      testType,
      reportKind,
      dob,
      hasScreening,
      screeningComplete,
      hasConfirmation,
      confirmationComplete: confirmationData.complete,
      confirmationSummarySubstances: confirmationData.summarySubstances,
      unmappedConfirmationLabels: confirmationData.unmappedConfirmationLabels,
      confirmationAnalytes: confirmationData.confirmationAnalytes,
      confirmationResults: confirmationData.confirmationResults,
    }
  } catch (error) {
    throw new Error(`Failed to extract lab test data: ${error instanceof Error ? error.message : String(error)}`)
  }
}
