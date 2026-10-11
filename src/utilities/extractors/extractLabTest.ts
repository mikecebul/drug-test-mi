import { parseDrugTestReport } from './parseDrugTestReport'
export {
  calculateLabConfidence,
  extractLabDonorName,
  parseCreatinineResult,
  parseScreenRows,
  type ExtractedLabData,
  type LabConfirmationAnalyte,
} from './profiles/lab'

/** Compatibility name for existing callers; lab parsing uses the shared pipeline. */
export async function extractLabTest(buffer: Buffer) {
  try {
    const report = await parseDrugTestReport(buffer, 'lab')
    if (report.reportFamily !== 'lab') throw new Error('Expected a lab report')
    return report
  } catch (error) {
    throw new Error(`Failed to extract lab test data: ${error instanceof Error ? error.message : String(error)}`)
  }
}
