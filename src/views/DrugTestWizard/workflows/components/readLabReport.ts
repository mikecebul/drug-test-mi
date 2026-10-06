import { MAX_REPORT_BYTES, parseDrugTestReport } from '@/utilities/extractors/parseDrugTestReport'

export async function readLabReportFile(file: File) {
  if (!file || file.size > MAX_REPORT_BYTES) throw new Error('Select a PDF report no larger than 10MB')
  const buffer = Buffer.from(await file.arrayBuffer())
  const report = await parseDrugTestReport(buffer, 'lab')
  if (report.reportFamily !== 'lab') throw new Error('Select a lab report')
  return { buffer, report }
}
