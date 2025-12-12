import { Section, Text } from '@react-email/components'
import * as React from 'react'
import { getResultColor, getResultLabel } from '../utils/constants'

interface ResultBadgeProps {
  result: string
}

/**
 * ResultBadge displays a color-coded badge for test results
 * Uses background color for Outlook compatibility (no fancy CSS)
 * Small, left-aligned badge positioned under heading
 */
export function ResultBadge({ result }: ResultBadgeProps) {
  const backgroundColor = getResultColor(result)
  const label = getResultLabel(result)

  return (
    <Section style={{ marginBottom: '16px' }}>
      <Text
        style={{
          display: 'inline-block',
          backgroundColor,
          color: '#ffffff',
          padding: '2px 12px',
          borderRadius: '12px',
          fontSize: '12px',
          fontWeight: 700,
          textTransform: 'uppercase',
          margin: '0 0 16px 0',
        }}
      >
        {label}
      </Text>
    </Section>
  )
}

ResultBadge.PreviewProps = {
  result: 'negative',
} as ResultBadgeProps
