'use client'

import type { ReactNode } from 'react'
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { formatSubstance } from '@/lib/substances'
import { getResultPresentation } from './result-presentation'

export type CollectionResultPreview = {
  initialScreenResult: string
  expectedPositives: string[]
  unexpectedPositives: string[]
  unexpectedNegatives: string[]
  autoAccept: boolean
}

export function CollectionResultStrip({
  preview,
  detected = [],
  isLoading = false,
  error = false,
  isDilute = false,
  breathalyzerTaken = false,
  breathalyzerResult,
  action,
  finalPending = false,
}: {
  preview?: CollectionResultPreview | null
  detected?: string[]
  isLoading?: boolean
  error?: boolean
  isDilute?: boolean
  breathalyzerTaken?: boolean
  breathalyzerResult?: number | null
  action?: ReactNode
  finalPending?: boolean
}) {
  const status = getResultPresentation(preview?.initialScreenResult, error ? 'error' : isLoading ? 'loading' : 'ready')
  const ready = !error && !isLoading && Boolean(preview)
  const expected = [...new Set([...(preview?.expectedPositives ?? []), ...(preview?.unexpectedNegatives ?? [])])]
  const substances = (values: string[]) =>
    values.length ? values.map((value) => formatSubstance(value)).join(', ') : 'None'
  const Icon = isLoading ? Loader2 : status.variant === 'success' ? CheckCircle2 : AlertCircle
  return (
    <Alert variant={status.variant} data-testid="collection-result-strip">
      <Icon className={isLoading ? 'animate-spin' : undefined} />
      <AlertTitle>
        <span className="flex flex-wrap items-center justify-between gap-3">
          <span>{status.label}</span>
          {action}
        </span>
      </AlertTitle>
      <AlertDescription>
        {ready && (
          <p>
            Expected: {substances(expected)} · Detected: {substances(detected)}
          </p>
        )}
        {isDilute && <p>Dilute sample</p>}
        {breathalyzerTaken && (
          <p>Breathalyzer: {breathalyzerResult == null ? 'Result required' : breathalyzerResult.toFixed(3)}</p>
        )}
        {finalPending && <p>Final result pending confirmation or decision</p>}
        {error && <p>Retry result verification before continuing.</p>}
      </AlertDescription>
    </Alert>
  )
}
