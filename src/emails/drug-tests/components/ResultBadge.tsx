import { Section, Text } from '@react-email/components'
import * as React from 'react'
import { getResultColor, getResultLabel } from '../utils/constants'

interface ResultBadgeProps {
  result: string
}

/**
 * ResultBadge displays a color-coded badge for test results
 * Uses background color for Outlook compatibility (no fancy CSS)
 */
export function ResultBadge({ result }: ResultBadgeProps) {
  const backgroundColor = getResultColor(result)
  const label = getResultLabel(result)

  return (
    <Section style={{ textAlign: 'center', marginBottom: '24px' }}>
      <Text
        style={{
          display: 'inline-block',
          backgroundColor,
          color: '#ffffff',
          padding: '12px 24px',
          borderRadius: '6px',
          fontSize: '16px',
          fontWeight: 700,
          textTransform: 'uppercase',
          margin: '0',
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
