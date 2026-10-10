'use client'

import type { ReactNode } from 'react'
import { Clock3 } from 'lucide-react'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Alert, AlertTitle } from '@/components/ui/alert'
import { ScreeningResults } from './ScreeningResults'
import { ResultStatusIcon, resultDangerText } from './ResultStatusIcon'
import { cn } from '@/utilities/cn'
import { formatSubstance } from '@/lib/substances'
import { formatCollectionDateShort } from '@/lib/date-utils'
import { getResultPresentation } from '../../components/result-presentation'

export function ResultReviewCard({
  reportLabel,
  presentation,
  screening,
  confirmations,
  decision,
  holdUntil,
  reportAction,
  isDilute,
  breathalyzerTaken,
  breathalyzerResult,
}: {
  reportLabel: string
  presentation: ReturnType<typeof getResultPresentation>
  screening?: Parameters<typeof ScreeningResults>[0]
  confirmations?: Array<{ substance: string; result: string }>
  decision?: string
  holdUntil?: string | null
  reportAction: ReactNode
  isDilute?: boolean
  breathalyzerTaken?: boolean
  breathalyzerResult?: number | null
}) {
  const pending = !confirmations?.length && (decision === 'request-confirmation' || decision === 'pending-decision')
  const status = screening?.error
    ? getResultPresentation(undefined, 'error')
    : screening?.isLoading
      ? getResultPresentation(undefined, 'loading')
      : screening && !screening.verified
        ? { label: 'Check screening results', variant: 'warning' as const }
        : presentation
  return (
    <Card aria-label="Results to send" data-testid="lab-review-results" className="overflow-hidden">
      <CardHeader className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 p-4">
        <div className="flex min-w-0 flex-col gap-2">
          <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">{reportLabel}</p>
          <h2
            className={cn(
              'flex items-center gap-3 text-xl font-bold',
              status.variant === 'destructive' && resultDangerText,
            )}
          >
            <ResultStatusIcon variant={status.variant} className="size-8" />
            {status.label}
          </h2>
        </div>
        {reportAction}
      </CardHeader>
      <CardContent className="px-4 pb-3">
        {screening && <ScreeningResults {...screening} review />}
        {!!confirmations?.length && (
          <section aria-label="Confirmation results" className={cn('flex flex-col gap-2', screening && 'mt-4')}>
            <h3 className={screening ? 'text-muted-foreground text-sm font-medium' : 'sr-only'}>
              Confirmation results
            </h3>
            <ul className="divide-border divide-y">
              {confirmations.map((row) => (
                <li key={row.substance} className="grid grid-cols-[minmax(0,1fr)_10rem] items-center gap-4 py-3">
                  <span className="font-medium">{formatSubstance(row.substance)}</span>
                  <span className="text-sm font-medium">
                    {row.result === 'confirmed-positive'
                      ? 'Confirmed positive'
                      : row.result === 'confirmed-negative'
                        ? 'Confirmed negative'
                        : row.result === 'inconclusive'
                          ? 'Inconclusive'
                          : 'Needs review'}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
        {!screening && isDilute && (
          <Alert variant="warning">
            <AlertTitle>Dilute sample</AlertTitle>
          </Alert>
        )}
        {!screening && breathalyzerTaken && (
          <Alert
            variant={breathalyzerResult == null ? 'warning' : breathalyzerResult > 0.0001 ? 'destructive' : 'success'}
          >
            <AlertTitle>
              Breathalyzer: {breathalyzerResult == null ? 'Result required' : breathalyzerResult.toFixed(3)}
            </AlertTitle>
          </Alert>
        )}
      </CardContent>
      {pending && (
        <CardFooter className="border-warning-border bg-warning-muted text-warning-foreground flex-wrap gap-2 border-t px-4 py-3">
          <Clock3 className="size-5 shrink-0" aria-hidden />
          <span className="font-semibold">
            {decision === 'request-confirmation' ? 'Confirmation requested' : 'Decision deferred'}
          </span>
          <span className="border-warning-border border-l pl-3 text-sm">Final result pending</span>
          {decision === 'pending-decision' && holdUntil && (
            <span className="basis-full pl-7 text-sm">Track until {formatCollectionDateShort(holdUntil)}</span>
          )}
        </CardFooter>
      )}
    </Card>
  )
}
