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
        const isPositive = confirmation.result === 'positive'
        const backgroundColor = isPositive ? '#fee2e2' : '#d1fae5'
        const borderColor = isPositive ? '#ef4444' : '#10b981'

        return (
          <Section
            key={index}
            style={{
              backgroundColor,
              border: `2px solid ${borderColor}`,
              borderRadius: '6px',
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
                color: isPositive ? '#991b1b' : '#065f46',
                margin: '0',
                textTransform: 'uppercase',
              }}
            >
              {confirmation.result}
            </Text>

            {confirmation.notes && (
              <Text
                style={{
                  fontSize: '12px',
                  color: '#6b7280',
                  margin: '4px 0 0 0',
                  fontStyle: 'italic',
                }}
              >
                {confirmation.notes}
              </Text>
            )}
          </Section>
        )
      })}
    </Section>
  )
}

ConfirmationSection.PreviewProps = {
  confirmationResults: [
    { substance: 'thc', result: 'negative', notes: 'Below detection limit' },
    { substance: 'cocaine', result: 'positive', notes: 'Confirmed at 150 ng/mL' },
  ],
} as ConfirmationSectionProps
