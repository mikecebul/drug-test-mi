import { CircleAlert, Clock4, FileText, Pill } from 'lucide-react'
import { ShadcnWrapper } from '@/components/ShadcnWrapper'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { APP_TIMEZONE, formatDob } from '@/lib/date-utils'
import { formatSubstance } from '@/lib/substances'
import type { DrugTest, Payment } from '@/payload-types'
import { cn } from '@/utilities/cn'
import { confirmationPrice } from '../confirmation/policy'
import { buildDrugTestSummaryState } from './summaryState'
import {
  summaryConfirmationRows,
  summaryConfirmationState,
  summaryScreeningRows,
  summaryMedications,
  type SummaryOutcome,
} from './summaryDetails'
import { TestPaymentCard } from './TestPaymentCard'
import { UpdateConfirmationDecisionDialog } from './UpdateConfirmationDecisionDialog'
import { getResultPresentation } from '@/views/DrugTestWizard/components/result-presentation'
import { ResultStatusIcon, resultDangerText } from '@/views/DrugTestWizard/workflows/lab-results/ResultStatusIcon'

function collectionTime(value?: string | null) {
  if (!value || !Number.isFinite(new Date(value).getTime())) return 'Not recorded'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: APP_TIMEZONE,
    timeZoneName: 'short',
  }).format(new Date(value))
}
function holdDeadline(value?: string | null) {
  if (!value || !Number.isFinite(new Date(value).getTime())) return null
  const date = new Date(value)
  return {
    date: new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: APP_TIMEZONE,
    }).format(date),
  }
}
const money = (value?: number | null) =>
  value == null ? 'Not recorded' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)

function ReportButton({ href, label }: { href?: string | null; label: string }) {
  return href ? (
    <Button
      size="sm"
      variant="link"
      nativeButton={false}
      render={<a href={href} target="_blank" rel="noopener noreferrer" />}
    >
      <FileText data-icon="inline-start" />
      {label}
    </Button>
  ) : null
}

function OutcomeRows({ rows, label }: { rows: SummaryOutcome[]; label: string }) {
  return (
    <Table aria-label={label}>
      <TableHeader>
        <TableRow className="border-border">
          <TableHead className="pl-0">Substance</TableHead>
          <TableHead className="w-[45%]">Result</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.substance} className="border-border">
            <TableCell className="py-3 pr-4 pl-0 whitespace-normal">
              <p className="font-medium">{formatSubstance(row.substance, true)}</p>
              {row.notes && <p className="text-muted-foreground mt-1 text-sm">{row.notes}</p>}
            </TableCell>
            <TableCell className="py-3 whitespace-normal">
              <span
                className={cn(
                  'flex items-start gap-2 font-medium',
                  row.tone === 'destructive'
                    ? resultDangerText
                    : row.tone === 'success'
                      ? 'text-success-foreground'
                      : row.tone === 'warning'
                        ? 'text-warning-foreground'
                        : 'text-muted-foreground',
                )}
              >
                {row.tone === 'pending' ? (
                  <Clock4 className="size-5 shrink-0" aria-hidden />
                ) : (
                  <ResultStatusIcon variant={row.tone} />
                )}
                {row.label}
              </span>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

export function DrugTestSummaryContent({
  test,
  dob,
  screeningReportHref,
  confirmationReportHref,
  paymentRecords,
}: {
  test: Partial<DrugTest>
  dob?: string | null
  screeningReportHref?: string | null
  confirmationReportHref?: string | null
  paymentRecords?: Partial<Payment>[] | null
}) {
  const summary = buildDrugTestSummaryState(test)
  const screening = summaryScreeningRows(test)
  const confirmation = summaryConfirmationRows(test)
  const confirmationState = summaryConfirmationState(test, confirmation)
  const result = test.isInconclusive
    ? { label: 'Inconclusive', variant: 'warning' as const }
    : test.initialScreenResult
      ? getResultPresentation(test.initialScreenResult)
      : null
  const hasConfirmation =
    test.confirmationDecision === 'request-confirmation' ||
    confirmation.length > 0 ||
    !!test.unexpectedPositives?.length ||
    !!test.unexpectedNegatives?.length
  const canUpdateDecision =
    !!test.id &&
    !confirmationReportHref &&
    !test.confirmationResults?.length &&
    (!!test.unexpectedPositives?.length || test.confirmationDecision === 'request-confirmation')
  const stageLabels = {
    collected: 'Collected',
    screened: 'Screened',
    'confirmation-pending': 'Confirmation pending',
    complete: 'Complete',
  }
  const medications = summaryMedications(test)
  const deadline = summary.isLabTest ? holdDeadline(test.confirmationHoldUntil) : null
  const decisionAction = canUpdateDecision ? (
    <UpdateConfirmationDecisionDialog
      drugTestId={test.id!}
      isLabTest={summary.isLabTest}
      initialDecision={summary.confirmationProgress.decision}
      initialConfirmationSubstances={test.confirmationSubstances || []}
      unexpectedPositives={test.unexpectedPositives || []}
    />
  ) : (
    <ReportButton href={confirmationReportHref} label="Confirmation PDF" />
  )
  return (
    <ShadcnWrapper className="staff-interface bg-muted min-h-[calc(100dvh-12rem)]">
      <section
        className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-5 sm:px-10 lg:px-0"
        aria-label="Drug test summary"
        data-testid="drug-test-summary"
      >
        <Card size="sm">
          <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-bold tracking-tight">{summary.testTypeLabel}</h2>
            <Badge
              variant={summary.isComplete ? 'success' : summary.screeningStatus === 'screened' ? 'info' : 'outline'}
            >
              {stageLabels[summary.screeningStatus]}
            </Badge>
          </CardHeader>
          <CardContent>
            <dl className="grid items-center gap-3 sm:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)_auto]">
              <div className="flex flex-col gap-1">
                <dt className="text-muted-foreground text-sm">Collected</dt>
                <dd className="font-medium">{collectionTime(test.collectionDate)}</dd>
              </div>
              {dob && (
                <div className="flex flex-col gap-1">
                  <dt className="text-muted-foreground text-sm">DOB</dt>
                  <dd className="font-medium">{formatDob(dob)}</dd>
                </div>
              )}
              {screeningReportHref && (
                <div className="justify-self-start sm:col-start-3 sm:justify-self-end">
                  <ReportButton href={screeningReportHref} label="View screening PDF" />
                </div>
              )}
            </dl>
          </CardContent>
        </Card>
        <div className="grid items-start gap-4 md:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
          <div className="flex min-w-0 flex-col gap-4">
            <Card size="sm" data-testid="test-summary-screening">
              <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
                <CardTitle className="font-bold">Screening results</CardTitle>
                {result && (
                  <Badge variant={result.variant === 'destructive' ? 'destructive-muted' : result.variant}>
                    {result.label}
                  </Badge>
                )}
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {screening.length ? (
                  <OutcomeRows rows={screening} label="Screening results" />
                ) : (
                  <p className="text-muted-foreground text-sm">
                    {test.initialScreenResult === 'negative' && !test.isInconclusive
                      ? 'No substances detected.'
                      : test.initialScreenResult
                        ? 'No substance findings recorded.'
                        : 'Awaiting screening results.'}
                  </p>
                )}
                {test.isDilute && (
                  <Alert variant="warning">
                    <CircleAlert />
                    <AlertTitle>Dilute sample</AlertTitle>
                  </Alert>
                )}
                {test.breathalyzerTaken && (
                  <p className="text-sm">
                    Breathalyzer:{' '}
                    <span className="font-medium">
                      {test.breathalyzerResult == null ? 'Not recorded' : test.breathalyzerResult.toFixed(3)}
                    </span>
                  </p>
                )}
              </CardContent>
            </Card>
            {hasConfirmation && (
              <Card size="sm" data-testid="test-summary-confirmation">
                <CardHeader className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="font-bold">Confirmation</CardTitle>
                    <Badge variant={confirmationState.variant}>{confirmationState.label}</Badge>
                  </div>
                  {decisionAction}
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  {confirmation.length > 0 && <OutcomeRows rows={confirmation} label="Confirmation results" />}
                  {test.finalStatus && test.isComplete && (
                    <p className="text-sm">
                      <span className="text-muted-foreground">Final result: </span>
                      <span className="font-medium">{summary.result.label.replace(/ \((?:Pass|Fail)\)/g, '')}</span>
                    </p>
                  )}
                  {!test.confirmationResults?.length && test.confirmationDecision !== 'accept' && (
                    <>
                      <Alert variant={confirmationState.variant === 'warning' ? 'warning' : 'info'}>
                        <Clock4 />
                        <AlertTitle className="sr-only">Confirmation availability</AlertTitle>
                        <AlertDescription className="w-full">
                          <div className="grid w-full gap-3 sm:grid-cols-2">
                            <dl className="flex flex-col gap-1">
                              <dt className="text-sm">Confirmation fee</dt>
                              <dd className="text-foreground font-bold">
                                {(test.payment?.confirmationFeeDue || 0) > 0
                                  ? money(test.payment?.confirmationFeeDue)
                                  : test.testType
                                    ? `${money(confirmationPrice(test.testType))} per substance`
                                    : 'Not recorded'}
                              </dd>
                            </dl>
                            {deadline && (
                              <dl className="border-warning-border flex flex-col gap-1 sm:border-l sm:pl-4">
                                <dt className="text-sm">Lab hold ends</dt>
                                <dd className="text-foreground font-bold">{deadline.date}</dd>
                              </dl>
                            )}
                          </div>
                        </AlertDescription>
                      </Alert>
                      {confirmationState.message && (
                        <p className="text-muted-foreground text-sm">{confirmationState.message}</p>
                      )}
                    </>
                  )}
                  {test.confirmationDecision === 'accept' && !confirmation.length && (
                    <p className="text-muted-foreground text-sm">{confirmationState.message}</p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
          <aside className="flex min-w-0 flex-col gap-4" aria-label="Payment and medications">
            <TestPaymentCard test={test} records={paymentRecords} />
            <Card size="sm" data-testid="test-summary-medications">
              <CardHeader>
                <CardTitle className="font-bold">Medications at collection</CardTitle>
              </CardHeader>
              <CardContent>
                {medications.length ? (
                  <ul className="flex flex-col gap-3">
                    {medications.map((med, index) => (
                      <li key={med.substance || index} className="flex items-start gap-2">
                        <Pill className="text-muted-foreground mt-0.5 size-5 shrink-0" aria-hidden />
                        <div className="min-w-0">
                          <p className="font-semibold">
                            {med.substance === 'unmapped' ? 'Other medication' : formatSubstance(med.substance, true)}
                          </p>
                          <p className="text-muted-foreground text-sm">{med.names.join(', ')}</p>
                          {med.required && <p className="text-muted-foreground text-sm">Required medication</p>}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground text-sm whitespace-pre-line">
                    {test.medicationsAtTestTime || 'No medications recorded at collection.'}
                  </p>
                )}
              </CardContent>
            </Card>
          </aside>
        </div>
        {summary.blockingFlags.length > 0 && (
          <Alert variant="warning">
            <CircleAlert />
            <AlertTitle>Record needs review</AlertTitle>
            <AlertDescription>
              <ul className="flex list-disc flex-col gap-1 pl-4">
                {summary.blockingFlags.map((flag) => (
                  <li key={flag}>{flag}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}
      </section>
    </ShadcnWrapper>
  )
}
