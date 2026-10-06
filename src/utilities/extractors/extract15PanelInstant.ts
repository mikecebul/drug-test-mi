import { parseDrugTestReport } from './parseDrugTestReport'
export { extractInstantDonorName, type Extracted15PanelData } from './profiles/instant'

/** Compatibility name for existing callers; instant parsing uses the shared pipeline. */
export async function extract15PanelInstant(buffer: Buffer) {
  try {
    const report = await parseDrugTestReport(buffer, 'instant')
    if (report.reportFamily !== 'instant') throw new Error('Expected an instant report')
    return report
  } catch (error) {
    throw new Error(
      `Failed to extract 15-panel instant test data: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}
