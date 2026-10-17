// Compatibility exports. Both report families use the same region engine.
import { extractReportTableRows } from './reportLayout'
import type { PositionedTextLine } from './pdfText'
export type { ReportTableRow as LabTableRow } from './reportLayout'
export { readReportField as readLabField, reportSummaryLines as labSummaryLines } from './reportLayout'
export function extractLabTableRows(lines: PositionedTextLine[]) {
  return extractReportTableRows(lines).filter((row) => row.method !== 'CIA')
}
