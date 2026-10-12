import * as React from 'react'
import type { CompleteEmailData } from '@/collections/DrugTests/email/types'
import { formatSubstance } from '../utils/formatters'
import { ResultRow } from './ResultRow'
import { SubstancesSection } from './SubstancesSection'

export function ConfirmationSection({
  confirmationResults = [],
  expectedPositives,
  unexpectedPositives,
  detectedSubstances,
}: Pick<
  CompleteEmailData,
  'confirmationResults' | 'expectedPositives' | 'unexpectedPositives' | 'detectedSubstances'
>) {
  const confirmed = new Set(confirmationResults.map((result) => result.substance))
  const remaining = [...new Set([...detectedSubstances, ...expectedPositives, ...unexpectedPositives])].filter(
    (substance) => !confirmed.has(substance),
  )
  if (confirmationResults.length === 0)
    return (
      <SubstancesSection
        detectedSubstances={detectedSubstances}
        expectedPositives={expectedPositives}
        unexpectedPositives={unexpectedPositives}
      />
    )
  return (
    <>
      {confirmationResults.map((confirmation, index) => {
        const isPositive = ['confirmed-positive', 'positive'].includes(confirmation.result)
        const isNegative = ['confirmed-negative', 'negative'].includes(confirmation.result)
        const isExpected =
          expectedPositives.includes(confirmation.substance) && !unexpectedPositives.includes(confirmation.substance)
        const status = isNegative
          ? 'Confirmed negative'
          : isPositive
            ? isExpected
              ? 'Expected'
              : 'Unexpected'
            : confirmation.result === 'inconclusive'
              ? 'Inconclusive'
              : 'Result unavailable'
        return (
          <ResultRow
            key={`${confirmation.substance}-${index}`}
            name={formatSubstance(confirmation.substance)}
            status={status}
            tone={isNegative || (isPositive && isExpected) ? 'negative' : isPositive ? 'positive' : 'warning'}
            detail={
              [isPositive ? 'Confirmed positive' : '', confirmation.notes].filter(Boolean).join(' · ') || undefined
            }
          />
        )
      })}
      {remaining.map((substance) => {
        const isExpected = expectedPositives.includes(substance) && !unexpectedPositives.includes(substance)
        return (
          <ResultRow
            key={substance}
            name={formatSubstance(substance)}
            status={isExpected ? 'Expected' : 'Unexpected'}
            tone={isExpected ? 'negative' : 'positive'}
            detail="Screening result · Not confirmed"
          />
        )
      })}
    </>
  )
}
