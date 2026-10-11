import { MAX_REPORT_BYTES, parseDrugTestReport } from '@/utilities/extractors/parseDrugTestReport'

export async function readLabReportFile(file: File) {
  if (!file || file.size > MAX_REPORT_BYTES) throw new Error('Select a PDF report no larger than 10MB')
  const buffer = Buffer.from(await file.arrayBuffer())
  const report = await parseDrugTestReport(buffer, 'lab')
  if (report.reportFamily !== 'lab') throw new Error('Select a lab report')
  return { buffer, report }
}

export interface ReportIdentityAcknowledgement {
  confirmed: boolean
  key: string | null
}
export async function verifyLabReportIdentity(
  report: import('../../types').ParsedPDFData,
  client: { firstName?: string | null; lastName?: string | null; middleInitial?: string | null; dob?: string | null },
  acknowledgement: ReportIdentityAcknowledgement | undefined,
) {
  const { getReportClientMatch, getReportClientMismatchKey } = await import('../instant-test/utils/reportClientMatch')
  const match = getReportClientMatch(report.donorName, client, report.dob)
  if (
    match.requiresConfirmation &&
    (!acknowledgement?.confirmed || acknowledgement.key !== getReportClientMismatchKey(match))
  )
    throw new Error('Verify the report belongs to this client before saving')
}
