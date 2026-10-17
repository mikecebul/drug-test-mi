import { z } from 'zod'
import { allSubstanceOptions, type SubstanceValue } from '@/fields/substanceOptions'
import type { ParsedPDFData } from '../../types'
import type { ConfirmationResult } from '@/utilities/extractors/labConfirmation'

export interface ConfirmationReviewRow {
  substance: string
  result: ConfirmationResult | ''
  notes?: string
  sourceLabels?: string[]
}
export interface ReviewedConfirmation {
  substance: SubstanceValue
  result: ConfirmationResult
  notes?: string
}
export const confirmationReviewRowSchema = z.object({
  substance: z.string().min(1, 'Select a substance'),
  result: z
    .enum(['', 'confirmed-positive', 'confirmed-negative', 'inconclusive'])
    .refine((value): boolean => value !== '', 'Choose a result for every confirmation'),
  notes: z.string().optional(),
  sourceLabels: z.array(z.string()).optional(),
})
// FormGroup distributes errors to registered fields. Keep row-level issues on
// the registered array field rather than unmounted per-row metadata.
export const confirmationReviewArraySchema = z.array(z.custom<ConfirmationReviewRow>()).superRefine((rows, ctx) => {
  const parsed = z.array(confirmationReviewRowSchema).safeParse(rows)
  if (!parsed.success)
    ctx.addIssue({ code: 'custom', message: 'Choose a substance and a result for every confirmation' })
})
const unique = (values: string[]) => [...new Set(values)]
export const isConfirmationResult = (value: string): value is ConfirmationResult =>
  value === 'confirmed-positive' || value === 'confirmed-negative' || value === 'inconclusive'

export function getConfirmationRequirements(report: ParsedPDFData | undefined) {
  const substances = unique([
    ...(report?.confirmationResults?.map((row) => row.substance) ?? []),
    ...(report?.confirmationAnalytes?.flatMap((row) => (row.substance ? [row.substance] : [])) ?? []),
    ...(report?.confirmationSummarySubstances ?? []),
  ])
  const unknownLabels = unique([
    ...(report?.confirmationAnalytes?.filter((row) => !row.substance).map((row) => row.analyte) ?? []),
    ...(report?.unmappedConfirmationLabels ?? []),
  ])
  if (
    report?.hasConfirmation &&
    report.confirmationComplete === false &&
    !unknownLabels.length &&
    !report.confirmationAnalytes?.some((row) => !row.result) &&
    !substances.some((substance) => !report.confirmationResults?.some((row) => row.substance === substance))
  ) {
    unknownLabels.push('Unverified confirmation')
  }
  return { substances, unknownLabels }
}

/** Populate once per report/collection; unknowns never receive a negative default. */
export function createConfirmationReviewRows(
  report: ParsedPDFData | undefined,
  requested: string[] = [],
  existing: ConfirmationReviewRow[] = [],
): ConfirmationReviewRow[] {
  const requirements = getConfirmationRequirements(report)
  const substances = unique([...requested, ...existing.map((row) => row.substance), ...requirements.substances])
  const rows: ConfirmationReviewRow[] = substances.map((substance) => {
    const parsed = report?.confirmationResults?.find((row) => row.substance === substance)
    const previous = existing.find((row) => row.substance === substance)
    const fromCurrentReport = requirements.substances.includes(substance)
    const analytes = report?.confirmationAnalytes?.filter((row) => row.substance === substance) ?? []
    const notes = analytes.map((row) => `${row.analyte}: ${row.resultText}`).join('; ')
    return {
      substance,
      result: parsed?.result ?? (fromCurrentReport ? '' : (previous?.result ?? '')),
      notes: parsed?.notes ?? (fromCurrentReport ? notes : (previous?.notes ?? '')),
    }
  })
  rows.push(
    ...requirements.unknownLabels.map((label) => ({
      substance: '',
      result: '' as const,
      notes: label,
      sourceLabels: [label],
    })),
  )
  return rows
}

/** Reconcile every requested/report substance and every explicitly mapped unknown. */
export function validateConfirmationReview(
  rows: ConfirmationReviewRow[],
  required: string[],
  unknownLabels: string[] = [],
): ReviewedConfirmation[] {
  if (!rows.length) throw new Error('At least one confirmation result is required')
  const allowed = new Set<string>(
    allSubstanceOptions.filter((option) => option.value !== 'none').map((option) => option.value),
  )
  const grouped = new Map<SubstanceValue, ReviewedConfirmation>()
  for (const row of rows) {
    if (!allowed.has(row.substance) || !isConfirmationResult(row.result))
      throw new Error('Choose a substance and a result for every confirmation before continuing')
    const substance = row.substance as SubstanceValue
    const current = grouped.get(substance)
    const results = [current?.result, row.result]
    const result = results.includes('confirmed-positive')
      ? 'confirmed-positive'
      : results.includes('inconclusive')
        ? 'inconclusive'
        : 'confirmed-negative'
    grouped.set(substance, {
      substance,
      result,
      notes: unique([current?.notes ?? '', row.notes ?? ''].filter(Boolean)).join('; ') || undefined,
    })
  }
  if (unique(required).some((substance) => !grouped.has(substance as SubstanceValue)))
    throw new Error('Results are still needed for every requested confirmation')
  if (unknownLabels.some((label) => !rows.some((row) => row.sourceLabels?.includes(label))))
    throw new Error('Review every unrecognized confirmation in the PDF before continuing')
  return [...grouped.values()]
}

/** Reuse stored results only when the current PDF does not require that substance's correction. */
export function reconcileConfirmationSubmission(
  report: ParsedPDFData,
  submitted: ConfirmationReviewRow[],
  requested: string[] = [],
  existing: ConfirmationReviewRow[] = [],
) {
  const requirements = getConfirmationRequirements(report)
  const currentSubjects = new Set([...requirements.substances, ...submitted.map((row) => row.substance)])
  const retained = existing.filter((row) => !currentSubjects.has(row.substance))
  const required = unique([...requested, ...existing.map((row) => row.substance), ...requirements.substances])
  const results = validateConfirmationReview([...retained, ...submitted], required, requirements.unknownLabels)
  return { results, substances: unique([...required, ...results.map((row) => row.substance)]) as SubstanceValue[] }
}

export function storedConfirmationRows(
  rows: Array<{ substance?: unknown; result?: unknown; notes?: unknown }>,
): ConfirmationReviewRow[] {
  return rows.flatMap((row) =>
    typeof row.substance === 'string' && typeof row.result === 'string' && isConfirmationResult(row.result)
      ? [{ substance: row.substance, result: row.result, notes: typeof row.notes === 'string' ? row.notes : undefined }]
      : [],
  )
}
export function resolvedConfirmationReview(rows: ConfirmationReviewRow[], required: string[] = []) {
  try {
    return validateConfirmationReview(rows, required)
  } catch {
    return null
  }
}
