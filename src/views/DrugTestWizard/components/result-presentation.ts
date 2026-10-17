export type ResultClassification =
  | 'negative'
  | 'expected-positive'
  | 'unexpected-positive'
  | 'unexpected-negative-critical'
  | 'unexpected-negative-warning'
  | 'mixed-unexpected'

export const resultPresentation: Record<
  ResultClassification,
  { label: string; variant: 'success' | 'warning' | 'destructive' }
> = {
  negative: { label: 'Negative', variant: 'success' },
  'expected-positive': { label: 'Expected positive', variant: 'success' },
  'unexpected-positive': { label: 'Unexpected positive', variant: 'destructive' },
  'unexpected-negative-critical': { label: 'Missing expected substance — critical', variant: 'destructive' },
  'unexpected-negative-warning': { label: 'Missing expected substance', variant: 'warning' },
  'mixed-unexpected': { label: 'Unexpected results', variant: 'destructive' },
}

export function getResultPresentation(
  classification: string | null | undefined,
  state: 'ready' | 'loading' | 'error' = 'ready',
) {
  if (state === 'error') return { label: 'Result could not be verified', variant: 'destructive' as const }
  if (state === 'loading' || !classification) return { label: 'Checking result', variant: 'warning' as const }
  return (
    resultPresentation[classification as ResultClassification] ?? {
      label: 'Result needs review',
      variant: 'warning' as const,
    }
  )
}
