'use client'

import { AlertCircle, CheckCircle2, Loader2, Pill } from 'lucide-react'
import { Alert, AlertTitle } from '@/components/ui/alert'
import { cn } from '@/utilities/cn'
import { formatSubstance } from '@/lib/substances'
import type { CollectionResultPreview } from '../../components/CollectionResultStrip'
import { getResultPresentation } from '../../components/result-presentation'

type Medication = { medicationName?: string | null; detectedAs?: string[] | null; required?: boolean | null }
export function screeningResultRows(preview: CollectionResultPreview, detected: string[], medications: Medication[]) {
  const namesFor = (substance: string) => [
    ...new Set(
      medications
        .filter((m) => m.detectedAs?.includes(substance))
        .map((m) => m.medicationName)
        .filter((name): name is string => !!name),
    ),
  ]
  const positives = [...new Set(detected.filter((s) => s !== 'none'))]
    .map((substance) => ({
      substance,
      medicationNames: namesFor(substance),
      status: preview.unexpectedPositives.includes(substance)
        ? ('unexpected' as const)
        : preview.expectedPositives.includes(substance)
          ? ('expected' as const)
          : ('unverified' as const),
    }))
    .sort((a, b) => Number(b.status === 'unexpected') - Number(a.status === 'unexpected'))
  const missing = [...new Set(preview.unexpectedNegatives)].map((substance) => ({
    substance,
    medicationNames: namesFor(substance),
    status:
      medications.some((m) => m.required && m.detectedAs?.includes(substance)) ||
      (!medications.some((m) => m.detectedAs?.includes(substance)) &&
        preview.initialScreenResult === 'unexpected-negative-critical')
        ? ('critical-missing' as const)
        : ('missing' as const),
  }))
  return { positives, missing }
}
const rowStates = {
  expected: { label: 'Expected', Icon: CheckCircle2, color: 'text-success-foreground', surface: 'border-border' },
  unexpected: {
    label: 'Unexpected',
    Icon: AlertCircle,
    color: 'text-destructive-foreground',
    surface: 'border-destructive-border bg-destructive-muted',
  },
  unverified: {
    label: 'Needs review',
    Icon: AlertCircle,
    color: 'text-warning-foreground',
    surface: 'border-warning-border bg-warning-muted',
  },
  missing: {
    label: 'Not detected',
    Icon: AlertCircle,
    color: 'text-warning-foreground',
    surface: 'border-warning-border bg-warning-muted',
  },
  'critical-missing': {
    label: 'Not detected · critical',
    Icon: AlertCircle,
    color: 'text-destructive-foreground',
    surface: 'border-destructive-border bg-destructive-muted',
  },
}

/** Present existing classifications; never turn unverified extraction into an all-negative result. */
export function ScreeningResults({
  preview,
  detected,
  medications,
  verified,
  isLoading,
  error,
  isDilute,
  breathalyzerTaken,
  breathalyzerResult,
}: {
  preview?: CollectionResultPreview | null
  detected: string[]
  medications: Medication[]
  verified: boolean
  isLoading?: boolean
  error?: boolean
  isDilute?: boolean
  breathalyzerTaken?: boolean
  breathalyzerResult?: number | null
}) {
  if (!verified || !preview || isLoading || error)
    return (
      <Alert variant={error ? 'destructive' : 'warning'} data-testid="screening-results-summary">
        {isLoading ? <Loader2 className="animate-spin" /> : <AlertCircle />}
        <AlertTitle>
          {error
            ? 'Result could not be verified'
            : !verified
              ? 'Check screening results in the PDF'
              : 'Checking results'}
        </AlertTitle>
      </Alert>
    )
  const rows = screeningResultRows(preview, detected, medications)
  const covered = new Set([...rows.positives, ...rows.missing].flatMap((row) => row.medicationNames))
  const otherMedications = [
    ...new Set(medications.map((m) => m.medicationName).filter((name): name is string => !!name && !covered.has(name))),
  ]
  const renderRows = (items: typeof rows.positives | typeof rows.missing, label: string) => (
    <section aria-label={label} className="flex flex-col gap-2">
      <h3 className="text-muted-foreground text-sm font-medium">{label}</h3>
      <ul className="flex flex-col gap-2">
        {items.map((row) => {
          const { label, Icon, color, surface } = rowStates[row.status]
          return (
            <li
              key={row.substance}
              data-testid={`screening-result-${row.substance}`}
              className={cn(
                'grid grid-cols-[minmax(0,1fr)_10rem] items-center gap-x-4 gap-y-2 rounded-lg border px-4 py-3',
                surface,
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium">{formatSubstance(row.substance)}</p>
                {!!row.medicationNames.length && (
                  <p className="text-muted-foreground text-sm">Medication: {row.medicationNames.join(', ')}</p>
                )}
              </div>
              <span className={cn('flex items-center justify-start gap-2 text-sm font-medium', color)}>
                <Icon className="size-5 shrink-0" />
                {label}
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
  const classificationKnown = [
    'negative',
    'expected-positive',
    'unexpected-positive',
    'unexpected-negative-warning',
    'unexpected-negative-critical',
    'mixed-unexpected',
  ].includes(preview.initialScreenResult)
  return (
    <div className="flex flex-col gap-4" data-testid="screening-results-summary">
      {!classificationKnown && (
        <Alert variant="warning">
          <AlertCircle />
          <AlertTitle>{getResultPresentation(preview.initialScreenResult).label}</AlertTitle>
        </Alert>
      )}
      {rows.positives.length
        ? renderRows(rows.positives, 'Detected positives')
        : classificationKnown && (
            <Alert
              variant={
                preview.initialScreenResult !== 'negative' || isDilute || rows.missing.length ? 'warning' : 'success'
              }
            >
              <CheckCircle2 />
              <AlertTitle>No substances detected</AlertTitle>
            </Alert>
          )}
      {!!rows.missing.length && renderRows(rows.missing, 'Expected but not detected')}
      {!!otherMedications.length && (
        <p className="text-muted-foreground flex items-center gap-2 text-sm">
          <Pill className="size-4 shrink-0" />
          Medications: {otherMedications.join(', ')}
        </p>
      )}
      {isDilute && (
        <Alert variant="warning">
          <AlertCircle />
          <AlertTitle>Dilute sample</AlertTitle>
        </Alert>
      )}
      {breathalyzerTaken && (
        <Alert
          variant={breathalyzerResult == null ? 'warning' : breathalyzerResult > 0.0001 ? 'destructive' : 'success'}
        >
          <AlertCircle />
          <AlertTitle>
            Breathalyzer: {breathalyzerResult == null ? 'Result required' : breathalyzerResult.toFixed(3)}
          </AlertTitle>
        </Alert>
      )}
    </div>
  )
}
