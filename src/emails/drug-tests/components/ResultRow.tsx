import { Column, Row, Section, Text } from '@react-email/components'
import * as React from 'react'
import { colors, text } from '../utils/theme'

export type ResultTone = 'positive' | 'negative' | 'warning' | 'neutral'

export function StatusIcon({ tone }: { tone: ResultTone }) {
  const color =
    tone === 'positive'
      ? colors.red
      : tone === 'negative'
        ? colors.green
        : tone === 'warning'
          ? colors.amber
          : colors.muted
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-block',
        width: '20px',
        height: '20px',
        lineHeight: '20px',
        borderRadius: '50%',
        backgroundColor: color,
        color: '#ffffff',
        textAlign: 'center',
        fontSize: '16px',
        fontWeight: 700,
        marginRight: '8px',
      }}
    >
      {tone === 'negative' ? '✓' : tone === 'positive' ? '!' : '–'}
    </span>
  )
}

export function ResultRow({
  name,
  status,
  tone,
  detail,
}: {
  name: string
  status: string
  tone: ResultTone
  detail?: string
}) {
  const color =
    tone === 'positive'
      ? colors.red
      : tone === 'negative'
        ? colors.green
        : tone === 'warning'
          ? colors.amber
          : colors.muted
  return (
    <Section style={{ borderBottom: `1px solid ${colors.border}`, padding: '14px 0' }}>
      <Row>
        <Column className="email-result-name" style={{ width: '64%', verticalAlign: 'top', paddingRight: '12px' }}>
          <Text style={{ ...text, fontWeight: 600 }}>{name}</Text>
          {detail && <Text style={{ ...text, color: colors.muted }}>{detail}</Text>}
        </Column>
        <Column className="email-result-status" style={{ width: '36%', verticalAlign: 'top' }}>
          <Text style={{ ...text, color, fontWeight: tone === 'positive' ? 700 : 600 }}>
            <StatusIcon tone={tone} />
            {status}
          </Text>
        </Column>
      </Row>
    </Section>
  )
}
