import * as React from 'react'
import { ResultRow } from './ResultRow'

export function BreathalyzerResult({ bac }: { bac?: number | null }) {
  if (bac === null || bac === undefined || !Number.isFinite(bac)) return null
  return (
    <ResultRow
      name="Breathalyzer"
      detail={`${bac.toFixed(3)} BAC`}
      status={bac > 0 ? 'Positive' : 'Negative'}
      tone={bac > 0 ? 'positive' : 'negative'}
    />
  )
}
