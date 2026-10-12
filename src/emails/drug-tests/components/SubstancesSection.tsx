import * as React from 'react'
import { formatSubstance } from '../utils/formatters'
import { ResultRow } from './ResultRow'

interface SubstancesSectionProps {
  detectedSubstances: string[]
  expectedPositives: string[]
  unexpectedPositives: string[]
}

export function SubstancesSection({
  detectedSubstances,
  expectedPositives,
  unexpectedPositives,
}: SubstancesSectionProps) {
  const substances = [...new Set([...detectedSubstances, ...unexpectedPositives, ...expectedPositives])]
  const expected = new Set(expectedPositives)
  const unexpected = new Set(unexpectedPositives)
  substances.sort(
    (a, b) =>
      Number(unexpected.has(b) || !expected.has(b)) - Number(unexpected.has(a) || !expected.has(a)) ||
      formatSubstance(a).localeCompare(formatSubstance(b)),
  )
  if (substances.length === 0) return <ResultRow name="No substances detected" status="Negative" tone="negative" />
  return (
    <>
      {substances.map((substance) => {
        const isExpected = expected.has(substance) && !unexpected.has(substance)
        return (
          <ResultRow
            key={substance}
            name={formatSubstance(substance)}
            status={isExpected ? 'Expected' : 'Unexpected'}
            tone={isExpected ? 'negative' : 'positive'}
          />
        )
      })}
    </>
  )
}
