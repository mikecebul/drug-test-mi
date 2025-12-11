import { Section, Text } from '@react-email/components'
import * as React from 'react'
import { contentSection } from '../utils/styles'

interface BreathalyzerResultProps {
  bac?: number | null
  result?: string | null
}

/**
 * BreathalyzerResult displays BAC (Blood Alcohol Content) level with pass/fail indicator
 */
export function BreathalyzerResult({ bac, result }: BreathalyzerResultProps) {
  if (bac === null || bac === undefined) {
    return null
  }

  const isPass = result === 'negative'
  const backgroundColor = isPass ? '#d1fae5' : '#fee2e2'
  const borderColor = isPass ? '#10b981' : '#ef4444'
  const textColor = isPass ? '#065f46' : '#991b1b'

  return (
    <Section
      style={{
        ...contentSection,
        backgroundColor,
        border: `2px solid ${borderColor}`,
        textAlign: 'center',
      }}
    >
      <Text
        style={{
          fontSize: '14px',
          fontWeight: 700,
          color: '#1f2937',
          margin: '0 0 8px 0',
          textTransform: 'uppercase',
        }}
      >
        Breathalyzer Result
      </Text>

      <Text
        style={{
          fontSize: '32px',
          fontWeight: 700,
          color: textColor,
          margin: '0 0 8px 0',
        }}
      >
        {bac.toFixed(3)} BAC
      </Text>

      <Text
        style={{
          fontSize: '16px',
          fontWeight: 600,
          color: textColor,
          margin: '0',
          textTransform: 'uppercase',
        }}
      >
        {isPass ? 'PASS' : 'FAIL'}
      </Text>
    </Section>
  )
}

BreathalyzerResult.PreviewProps = {
  bac: 0.0,
  result: 'negative',
} as BreathalyzerResultProps
