import type { DocumentViewServerProps, Payload } from 'payload'
import { AlertTriangle, ClipboardList, FileText, FlaskConical, ShieldCheck } from 'lucide-react'

import { ShadcnWrapper } from '@/components/ShadcnWrapper'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCollectionDate } from '@/lib/date-utils'
import type { DrugTest } from '@/payload-types'
import { cn } from '@/utilities/cn'

import { buildDrugTestSummaryState } from './summaryState'
import { UpdateConfirmationDecisionDialog } from './UpdateConfirmationDecisionDialog'

const SCREENING_STATUS_LABELS: Record<DrugTest['screeningStatus'], string> = {
  collected: 'Collected',
  screened: 'Screened',
  'confirmation-pending': 'Confirmation Pending',
  complete: 'Complete',
}

const SCREENING_STATUS_STYLES: Record<
  DrugTest['screeningStatus'],
  {
    variant: 'default' | 'outline' | 'warning' | 'success'
    className?: string
  }
> = {
  collected: {
    variant: 'outline',
    className: 'border-primary/40 bg-primary/10 text-primary',
  },
  screened: {
    variant: 'outline',
    className: 'border-info/40 bg-info-muted text-info-foreground',
  },
  'confirmation-pending': {
    variant: 'warning',
    className: 'border-warning/40',
  },
  complete: {
    variant: 'success',
  },
}

const RESULT_SOURCE_LABELS = {
  final: 'Final Result',
  initial: 'Initial Result',
  pending: 'No Result Yet',
} as const

function formatDecision(decision: DrugTest['confirmationDecision'] | null | undefined): string {
  if (!decision) return 'Not Set'
  if (decision === 'pending-decision') return 'Pending Decision'
  if (decision === 'accept') return 'Accept Results'
  return 'Request Confirmation'
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
}

async function resolveReportLink(
  reportField: DrugTest['testDocument'] | DrugTest['confirmationDocument'] | undefined,
  payload: Payload,
): Promise<string | null> {
  if (!reportField) return null

  if (typeof reportField === 'string' && reportField.trim().length > 0) {
    try {
      const media = await payload.findByID({
        collection: 'private-media',
        id: reportField,
        depth: 0,
      })

      if (typeof media?.url === 'string' && media.url.trim().length > 0) {
        return media.url
      }

      if (typeof media?.filename === 'string' && media.filename.trim().length > 0) {
        return `${payload.config.routes.api}/private-media/file/${encodeURIComponent(media.filename)}`
      }
    } catch {
      return null
    }

    return null
  }

  if (typeof reportField === 'object' && reportField !== null) {
    const maybeUrl = typeof reportField.url === 'string' ? reportField.url : null
    if (maybeUrl && maybeUrl.trim().length > 0) {
      return maybeUrl
    }

    const maybeId = typeof reportField.id === 'string' ? reportField.id : null
    if (maybeId && maybeId.trim().length > 0) {
      try {
        const media = await payload.findByID({
          collection: 'private-media',
          id: maybeId,
          depth: 0,
        })

        if (typeof media?.url === 'string' && media.url.trim().length > 0) {
          return media.url
        }

        if (typeof media?.filename === 'string' && media.filename.trim().length > 0) {
          return `${payload.config.routes.api}/private-media/file/${encodeURIComponent(media.filename)}`
        }
      } catch {
        return null
      }
    }
  }

  return null
}

function SubstanceSnapshot({
  label,
  items,
  variant,
}: {
  label: string
  items: string[]
  variant: 'outline' | 'secondary' | 'destructive' | 'warning'
}) {
  return (
    <div className="space-y-2">
      <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{label}</p>
      {items.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {items.map((item) => (
            <Badge key={`${label}-${item}`} variant={variant}>
              {item}
            </Badge>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">None recorded.</p>
      )}
    </div>
  )
}

export default async function DrugTestSummaryView({ doc, payload }: DocumentViewServerProps) {
  const testDoc = doc as Partial<DrugTest>
  const summary = buildDrugTestSummaryState(testDoc)
  const testId = typeof testDoc.id === 'string' ? testDoc.id : null
  const rawCollectionDate = (doc as Record<string, unknown>).collectionDate
  const unexpectedPositives = asStringArray(testDoc.unexpectedPositives)
  const confirmationSubstances = asStringArray(testDoc.confirmationSubstances)
  const canAdjustConfirmationDecision =
    testId !== null &&
    (unexpectedPositives.length > 0 || summary.confirmationProgress.decision === 'request-confirmation')
  const showConfirmationSnapshot =
    summary.confirmationProgress.decision !== null || unexpectedPositives.length > 0
  const confirmationReportHref = await resolveReportLink(testDoc.confirmationDocument, payload)
  const screeningReportHref = await resolveReportLink(testDoc.testDocument, payload)
  const reportHref = confirmationReportHref || screeningReportHref

  const collectionDateLabel =
    typeof rawCollectionDate === 'string' || rawCollectionDate instanceof Date
      ? formatCollectionDate(rawCollectionDate)
      : 'Not recorded'

  const hasFindings =
    summary.findings.detectedSubstances.length > 0 ||
    summary.findings.expectedPositives.length > 0 ||
    summary.findings.unexpectedPositives.length > 0 ||
    summary.findings.unexpectedNegatives.length > 0

  const confirmationStatus =
    summary.confirmationProgress.decision === 'request-confirmation'
      ? {
          label: summary.confirmationProgress.isComplete ? 'Results Received' : 'Awaiting Results',
          variant: summary.confirmationProgress.isComplete ? ('secondary' as const) : ('warning' as const),
        }
      : summary.confirmationProgress.decision === 'accept'
        ? { label: 'Accepted', variant: 'secondary' as const }
        : { label: 'Decision Pending', variant: 'outline' as const }
  const statusBadgeStyle = SCREENING_STATUS_STYLES[summary.screeningStatus]

  return (
    <ShadcnWrapper className="mx-auto flex max-w-6xl flex-col gap-6 pt-8 pb-6 sm:pt-6">
      <header className="space-y-1 px-4 py-1 lg:px-0 lg:py-0">
        <h1 className="text-3xl font-semibold tracking-tight">Drug Test Summary</h1>
        <p className="text-muted-foreground text-sm">
          Workflow snapshot with the next required step and quick confirmation decision updates.
        </p>
      </header>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>Workflow Status</CardTitle>
              <Badge
                variant={statusBadgeStyle.variant}
                className={cn('rounded-full px-3 py-1 text-sm font-semibold', statusBadgeStyle.className)}
              >
                {SCREENING_STATUS_LABELS[summary.screeningStatus]}
              </Badge>
            </div>
            <CardDescription>Latest result metadata and report access.</CardDescription>
          </div>
          {reportHref ? (
            <Button asChild className="w-full sm:w-auto">
              <a href={reportHref} target="_blank" rel="noopener noreferrer">
                <FileText className="h-4 w-4" />
                View PDF Report
              </a>
            </Button>
          ) : (
            <p className="text-muted-foreground text-sm sm:self-center">No report available.</p>
          )}
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div className="space-y-1">
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Result</p>
            <div className="flex flex-wrap gap-1.5">
              <Badge variant={summary.result.variant}>{summary.result.label}</Badge>
              <Badge variant="outline">{RESULT_SOURCE_LABELS[summary.result.source]}</Badge>
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Test Type</p>
            <p className="text-sm">{summary.testTypeLabel}</p>
          </div>

          <div className="space-y-1">
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Collection Date
            </p>
            <p className="text-sm">{collectionDateLabel}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5" />
            Findings Snapshot
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <SubstanceSnapshot
            label="Detected Substances"
            items={summary.findings.detectedSubstances}
            variant="outline"
          />
          <SubstanceSnapshot
            label="Expected Positives"
            items={summary.findings.expectedPositives}
            variant="secondary"
          />
          <SubstanceSnapshot
            label="Unexpected Positives"
            items={summary.findings.unexpectedPositives}
            variant="destructive"
          />
          <SubstanceSnapshot
            label="Unexpected Negatives"
            items={summary.findings.unexpectedNegatives}
            variant="warning"
          />
          {!hasFindings && (
            <p className="text-muted-foreground text-sm md:col-span-2">
              No screening findings are available yet.
            </p>
          )}
        </CardContent>
      </Card>

      {showConfirmationSnapshot && (
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <CardTitle>Confirmation Snapshot</CardTitle>
            {canAdjustConfirmationDecision && testId && (
              <UpdateConfirmationDecisionDialog
                drugTestId={testId}
                initialDecision={summary.confirmationProgress.decision}
                initialConfirmationSubstances={confirmationSubstances}
                unexpectedPositives={unexpectedPositives}
              />
            )}
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Decision</p>
              <p className="text-sm">{formatDecision(summary.confirmationProgress.decision)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Confirmation Status</p>
              <Badge variant={confirmationStatus.variant}>{confirmationStatus.label}</Badge>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Next Step</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="info">
            <ClipboardList />
            <AlertTitle>Recommended Action</AlertTitle>
            <AlertDescription>
              <p>{summary.nextStep}</p>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {summary.blockingFlags.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              Data Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Alert variant="warning">
              <AlertTriangle />
              <AlertTitle>Review Data Consistency</AlertTitle>
              <AlertDescription>
                <ul className="list-disc space-y-1 pl-5">
                  {summary.blockingFlags.map((flag) => (
                    <li key={flag}>{flag}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}
    </ShadcnWrapper>
  )
}
