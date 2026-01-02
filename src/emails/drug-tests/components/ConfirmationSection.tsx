import { Section, Text } from '@react-email/components'
import * as React from 'react'
import type { ConfirmationResult } from '@/collections/DrugTests/email/types'
import { formatSubstance } from '../utils/formatters'
import { contentSection } from '../utils/styles'

interface ConfirmationSectionProps {
  confirmationResults?: ConfirmationResult[]
}

/**
 * ConfirmationSection displays confirmation test results (LC-MS/MS)
 * Shows each substance tested with its confirmation result
 */
export function ConfirmationSection({ confirmationResults }: ConfirmationSectionProps) {
  if (!confirmationResults || confirmationResults.length === 0) {
    return null
  }

  return (
    <Section style={contentSection}>
      <Text
        style={{
          fontSize: '18px',
          fontWeight: 700,
          color: '#1f2937',
          margin: '0 0 16px 0',
        }}
      >
        Confirmation Test Results (LC-MS/MS)
      </Text>

      {confirmationResults.map((confirmation, index) => {
        const isPositive = confirmation.result === 'confirmed-positive'
        const isInconclusive = confirmation.result === 'inconclusive'

        const backgroundColor = isPositive
          ? '#fee2e2'  // red
          : isInconclusive
          ? '#fef3c7'  // yellow
          : '#d1fae5'  // green

        const borderColor = isPositive
          ? '#ef4444'  // red
          : isInconclusive
          ? '#f59e0b'  // yellow
          : '#10b981'  // green

        const textColor = isPositive
          ? '#991b1b'  // dark red
          : isInconclusive
          ? '#92400e'  // dark yellow
          : '#065f46'  // dark green

        return (
          <Section
            key={index}
            style={{
              backgroundColor,
              border: `2px solid ${borderColor}`,
              borderRadius: '8px',
              padding: '12px',
              marginBottom: index < confirmationResults.length - 1 ? '12px' : '0',
            }}
          >
            <Text
              style={{
                fontSize: '14px',
                fontWeight: 700,
                color: '#1f2937',
                margin: '0 0 4px 0',
              }}
            >
              {formatSubstance(confirmation.substance)}
            </Text>

            <Text
              style={{
                fontSize: '14px',
                fontWeight: 600,
                color: textColor,
                margin: '0 0 4px 0',
                textTransform: 'uppercase',
              }}
            >
              {confirmation.result}
            </Text>

            <Text
              style={{
                fontSize: '12px',
                color: '#6b7280',
                margin: '0',
                fontStyle: 'italic',
              }}
            >
              {isInconclusive
                ? 'Sample could not be confirmed one way or the other'
                : 'Confirmed via LC-MS/MS'}
            </Text>
          </Section>
        )
      })}
    </Section>
  )
}

ConfirmationSection.PreviewProps = {
  confirmationResults: [
    { substance: 'thc', result: 'confirmed-negative', notes: 'Below detection limit' },
    { substance: 'cocaine', result: 'confirmed-positive', notes: 'Confirmed at 150 ng/mL' },
    { substance: 'amphetamines', result: 'inconclusive', notes: 'Sample requires retesting' },
  ],
} as ConfirmationSectionProps
