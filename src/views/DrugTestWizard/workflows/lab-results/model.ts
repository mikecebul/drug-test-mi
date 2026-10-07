import { formOptions } from '@tanstack/react-form'
import { z } from 'zod'
import type { DrugTest } from '@/payload-types'
import type { ParsedPDFData } from '../../types'
import { getLabScreenFormOpts } from '../lab-screen/shared-form'
import { getLabConfirmationFormOpts } from '../lab-confirmation/shared-form'
import { labScreenDataSchema } from '../lab-screen/validators'
import { labConfirmationDataSchema } from '../lab-confirmation/validators'
import { emailsGroupSchema, uploadSchema } from '../shared-validators'
import { getReportClientMatch, getReportClientMismatchKey } from '../instant-test/utils/reportClientMatch'
import type { ClientDetailsValue } from '../components/client/ClientDetailsCard'

export const labSteps = ['upload', 'match', 'results', 'review'] as const
export const reportTypes = ['auto', 'screening', 'confirmation'] as const
export type ReportType = (typeof reportTypes)[number]
export type EntryMode = Exclude<ReportType, 'auto'>
export type ScreenValues = ReturnType<typeof getLabScreenFormOpts>['defaultValues']['labScreenData']
export type ConfirmationValues = ReturnType<typeof getLabConfirmationFormOpts>['defaultValues']['labConfirmationData']

export function sortLabCollections<
  T extends { id: string; clientName?: string | null; collectionDate?: string | null },
>(collections: readonly T[], selectedId: string): T[] {
  const timestamp = (value?: string | null) => {
    const time = value ? new Date(value).getTime() : NaN
    return Number.isFinite(time) ? time : Infinity
  }
  return [...collections].sort((a, b) => {
    if ((a.id === selectedId) !== (b.id === selectedId)) return a.id === selectedId ? -1 : 1
    return (
      (a.clientName?.trim() ?? '').localeCompare(b.clientName?.trim() ?? '', 'en', {
        sensitivity: 'base',
        numeric: true,
      }) ||
      timestamp(a.collectionDate) - timestamp(b.collectionDate) ||
      a.id.localeCompare(b.id)
    )
  })
}

export function resolveEntryMode(type: ReportType, report: ParsedPDFData | undefined, status?: string): EntryMode {
  if (type !== 'auto') return type
  if (status === 'screened' || status === 'confirmation-pending' || report?.reportKind === 'confirmation')
    return 'confirmation'
  return 'screening'
}
export function eligibleLabCollection(
  test: Pick<DrugTest, 'screeningStatus' | 'confirmationDecision'>,
  type: ReportType,
  report?: ParsedPDFData,
) {
  if (test.screeningStatus === 'complete') return false
  if (test.screeningStatus === 'collected') return type !== 'confirmation' && report?.reportKind !== 'confirmation'
  return (
    (test.screeningStatus === 'screened' || test.screeningStatus === 'confirmation-pending') &&
    test.confirmationDecision === 'request-confirmation' &&
    type !== 'screening' &&
    (type === 'confirmation' || report?.hasConfirmation === true)
  )
}
export function reportTypeLabel(report?: ParsedPDFData) {
  return report?.reportKind === 'screening-and-confirmation'
    ? 'Screen + confirmation'
    : report?.reportKind === 'confirmation'
      ? 'Confirmation report'
      : report?.reportKind === 'screening'
        ? 'Screening report'
        : 'Check report type'
}
export function legacyLabStep(step: string | null) {
  if (step === 'extract') return 'upload'
  if (step === 'matchCollection') return 'match'
  if (step === 'labScreenData' || step === 'labConfirmationData' || step === 'confirm') return 'results'
  if (step === 'emails') return 'review'
  return labSteps.includes(step as (typeof labSteps)[number]) ? (step as (typeof labSteps)[number]) : 'upload'
}

export function reportIdentity(report: ParsedPDFData | undefined, client: ClientDetailsValue | null | undefined) {
  if (!client) return null
  return getReportClientMatch(report?.donorName, client, report?.dob)
}
export { getReportClientMismatchKey }

export const matchSchema = z.object({
  testId: z.string().min(1, 'Choose a collection'),
  clientName: z.string(),
  headshot: z.string().nullable().optional(),
  testType: z.string(),
  collectionDate: z.string(),
  screeningStatus: z.string(),
  matchType: z.enum(['exact', 'fuzzy', 'manual']),
  score: z.number(),
  clientMismatchConfirmed: z.boolean(),
  clientMismatchConfirmationKey: z.string().nullable(),
})
export const resultsSchema = z
  .object({
    mode: z.enum(['screening', 'confirmation']),
    screening: z.custom<ScreenValues>(),
    confirmation: z.custom<ConfirmationValues>(),
    screeningVerified: z.boolean(),
  })
  .superRefine((data, ctx) => {
    const schema =
      data.mode === 'screening'
        ? labScreenDataSchema.shape.labScreenData
        : labConfirmationDataSchema.shape.labConfirmationData
    const result = schema.safeParse(data.mode === 'screening' ? data.screening : data.confirmation)
    if (!result.success)
      result.error.issues.forEach((issue) =>
        ctx.addIssue({ code: 'custom', message: issue.message, path: [data.mode, ...issue.path] }),
      )
    if (data.mode === 'screening' && !data.screeningVerified)
      ctx.addIssue({ code: 'custom', message: 'Verify the screening results in the PDF', path: ['screeningVerified'] })
  })
export function getLabResultsFormOpts() {
  const screen = getLabScreenFormOpts().defaultValues
  const confirmation = getLabConfirmationFormOpts().defaultValues
  return formOptions({
    defaultValues: {
      upload: screen.upload,
      reportType: 'auto' as ReportType,
      matchCollection: {
        ...screen.matchCollection,
        clientMismatchConfirmed: false,
        clientMismatchConfirmationKey: null as string | null,
      },
      results: {
        mode: 'screening' as EntryMode,
        screening: screen.labScreenData,
        confirmation: confirmation.labConfirmationData,
        screeningVerified: false,
      },
      emails: screen.emails,
    },
  })
}
export type LabResultsValues = ReturnType<typeof getLabResultsFormOpts>['defaultValues']
export { uploadSchema, emailsGroupSchema }
