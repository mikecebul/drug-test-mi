import fs from 'node:fs/promises'
import path from 'node:path'
import { parseDrugTestReport } from '../src/utilities/extractors/parseDrugTestReport'

type Confidence = 'high' | 'medium' | 'low'

type AuditSummary = {
  scanned: number
  instant: number
  lab: number
  unsupported: number
  failures: number
  incomplete: number
  warnings: number
  confirmations: number
  manualReview: number
  confidence: Record<Confidence, number>
  incompletePatterns: Record<string, number>
}

async function findPdfs(root: string): Promise<string[]> {
  const entries = await fs.readdir(root, { withFileTypes: true })
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(root, entry.name)
      if (entry.isDirectory()) return findPdfs(entryPath)
      return entry.isFile() && entry.name.toLowerCase().endsWith('.pdf') ? [entryPath] : []
    }),
  )
  return nested.flat()
}

function incrementConfidence(summary: AuditSummary, confidence: Confidence) {
  summary.confidence[confidence] += 1
}

async function main() {
  const roots = process.argv.slice(2).filter((argument) => argument !== '--')
  if (roots.length === 0) {
    throw new Error('Pass one or more local directories containing private report PDFs.')
  }

  const files = (await Promise.all(roots.map((root) => findPdfs(path.resolve(root))))).flat()
  const summary: AuditSummary = {
    scanned: files.length,
    instant: 0,
    lab: 0,
    unsupported: 0,
    failures: 0,
    incomplete: 0,
    warnings: 0,
    confirmations: 0,
    manualReview: 0,
    confidence: { high: 0, medium: 0, low: 0 },
    incompletePatterns: {},
  }

  for (const file of files) {
    try {
      const buffer = await fs.readFile(file)
      const result = await parseDrugTestReport(buffer)
      summary[result.reportFamily] += 1
      summary.incomplete += result.resultsComplete ? 0 : 1
      summary.manualReview += result.requiresReview ? 1 : 0
      if (!result.resultsComplete) {
        const key = `${result.testType}:${result.resultRowCount}`
        summary.incompletePatterns[key] = (summary.incompletePatterns[key] ?? 0) + 1
      }
      summary.warnings += result.parseWarnings.length
      summary.confirmations += result.reportFamily === 'lab' && result.hasConfirmation ? 1 : 0
      incrementConfidence(summary, result.confidence)
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Unsupported PDF:')) summary.unsupported += 1
      else summary.failures += 1
    }
  }

  // Deliberately emit only aggregate results: never client names, report text,
  // or private file paths.
  console.log(JSON.stringify(summary, null, 2))
  if (summary.failures > 0) process.exitCode = 1
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
