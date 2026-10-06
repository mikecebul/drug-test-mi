import { extractPositionedPdfText } from './pdfText'
import { extractReportTableRows, readReportField, supportedAssayMethod, derivedReportRow } from './reportLayout'
import { parseReportCollectionTime } from './reportDate'
import { normalizeExtractedDonorName } from './donorName'
import { parseInstantReport, type Extracted15PanelData } from './profiles/instant'
import { parseLabReport, type ExtractedLabData } from './profiles/lab'

export const MAX_REPORT_BYTES = 10 * 1024 * 1024
export type ReportFamily = 'instant' | 'lab'
interface Assessment {
  parserVersion: 'pdfjs-regions-v2'
  requiresReview: boolean
  reviewReasons: string[]
}
export type ParsedDrugTestReport =
  | (Extracted15PanelData & Assessment & { reportFamily: 'instant'; reportKind: 'screening' })
  | (ExtractedLabData & Assessment & { reportFamily: 'lab' })

/** Single entry point: one PDF.js read, shared table regions, then assay interpretation. */
export async function parseDrugTestReport(
  buffer: Buffer,
  expectedFamily?: ReportFamily,
): Promise<ParsedDrugTestReport> {
  if (buffer.byteLength > MAX_REPORT_BYTES) throw new Error('PDF is too large. The maximum report size is 10MB.')
  const document = await extractPositionedPdfText(buffer),
    rows = extractReportTableRows(document.lines)
  const hasInstant = rows.some((row) => row.method === 'CIA'),
    hasLab = rows.some((row) => /^(?:EA|EIA|LC[/-]MS[/-]MS|GC[/-]MS)$/i.test(row.method))
  const instantMarker = /\biCup\s+Urine\b|\b17\s+Panel\s+Slim\s+Cup\b|\b15\s*[- ]?\s*Panel\s+Instant\b/i.test(
    document.rawText,
  )
  const labMarker = /\bB(?:729|829|814|306)\b|\b(?:049|050)\b\s*-?\s*(?:Ethyl Glucuronide|EtG)/i.test(document.rawText)
  if ((hasInstant && hasLab) || (instantMarker && labMarker))
    throw new Error('This PDF contains mixed instant and lab reports. Upload one report at a time.')
  const family: ReportFamily | null = hasInstant || instantMarker ? 'instant' : hasLab || labMarker ? 'lab' : null
  if (!family)
    throw new Error(
      'Unsupported PDF: no supported drug-test report layout was found. Image-only reports require manual review.',
    )
  if (expectedFamily && family !== expectedFamily)
    throw new Error(`This is a ${family} report. Use the ${family === 'lab' ? 'lab result' : 'instant test'} workflow.`)
  const donors = new Set(
    document.lines
      .map((line) => readReportField([line], /^(?:Identification|Donor Name):$/i))
      .filter((value): value is string => Boolean(value))
      .map((value) => normalizeExtractedDonorName(value).toLowerCase()),
  )
  const collections = new Set(
    document.lines
      .map((line) => readReportField([line], /^Collected:$/i))
      .filter((value): value is string => Boolean(value))
      .map((value) => parseReportCollectionTime(value)?.getTime() ?? value),
  )
  const dobs = new Set(
    document.lines
      .map((line) => readReportField([line], /^(?:DOB|Date of Birth):$/i))
      .filter((value): value is string => Boolean(value))
      .map((value) => value.split('/').map(Number).join('/')),
  )
  if (donors.size > 1 || collections.size > 1 || dobs.size > 1)
    throw new Error('This PDF contains multiple donors or collections. Upload one report at a time.')
  if (
    family === 'lab' &&
    new Set(document.rawText.match(/\bB(?:729|829|814|306)\b/gi)?.map((code) => code.toUpperCase())).size > 1
  )
    throw new Error('This PDF contains multiple lab panel profiles. Upload one report at a time.')
  const parsed = family === 'instant' ? parseInstantReport(document, rows) : parseLabReport(document, rows)
  const unknownMethods = rows.filter((row) => !supportedAssayMethod(row.method) && !derivedReportRow(row))
  if (unknownMethods.length) {
    parsed.parseWarnings.push(
      `${unknownMethods.length} result row${unknownMethods.length === 1 ? ' has' : 's have'} a missing or unsupported assay method; verify the PDF.`,
    )
    parsed.resultsComplete = false
    parsed.confidenceScore = Math.min(parsed.confidenceScore, 84)
    parsed.confidence = parsed.confidenceScore >= 60 ? 'medium' : 'low'
    if ('hasConfirmation' in parsed && parsed.hasConfirmation) parsed.confirmationComplete = false
  }
  const reviewReasons: string[] = []
  if (!parsed.resultsComplete) reviewReasons.push('incomplete-or-ambiguous-results')
  if (parsed.parseWarnings.length) reviewReasons.push('parser-warnings')
  if (!parsed.donorName) reviewReasons.push('missing-donor')
  if (!parsed.identityAnchored) reviewReasons.push('unanchored-identity')
  if (!parsed.collectionDate) reviewReasons.push('missing-or-invalid-collection-time')
  if (!parsed.dob) reviewReasons.push('missing-dob')
  if (parsed.confidence !== 'high') reviewReasons.push('low-parser-confidence')
  if (rows.some((row) => row.layout === 'inferred')) reviewReasons.push('inferred-table-layout')
  if (unknownMethods.length) reviewReasons.push('missing-or-unsupported-assay-method')
  const assessment: Assessment = {
    parserVersion: 'pdfjs-regions-v2',
    requiresReview: reviewReasons.length > 0,
    reviewReasons,
  }
  return family === 'instant'
    ? { ...(parsed as Extracted15PanelData), ...assessment, reportFamily: 'instant', reportKind: 'screening' }
    : { ...(parsed as ExtractedLabData), ...assessment, reportFamily: 'lab' }
}

/** Parse-quality gate; client matching, unreported fields and workflow authorization remain separate. */
export function assertReportParsedWithoutReview(report: ParsedDrugTestReport): void {
  if (report.requiresReview || !report.resultsComplete)
    throw new Error('This report requires manual review before automated processing.')
}
