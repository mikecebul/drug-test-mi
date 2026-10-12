import { Column, Row, Section, Text } from '@react-email/components'
import * as React from 'react'
import { colors, text } from '../utils/theme'
import { EmailIcon } from './EmailIcon'

type NoticeTone = 'warning' | 'success' | 'error' | 'neutral'

export function Notice({
  title,
  children,
  tone = 'warning',
}: {
  title: string
  children?: React.ReactNode
  tone?: NoticeTone
}) {
  const palette = (
    {
      warning: { background: '#fff8eb', border: '#f3c877', icon: 'clock-amber' },
      success: { background: '#f0faf3', border: '#acd7b7', icon: 'circle-check-green' },
      error: { background: '#fff3f3', border: '#f4b6bd', icon: 'circle-alert-red' },
      neutral: { background: '#f7f8fa', border: colors.border, icon: 'circle-check-gray' },
    } as const
  )[tone]
  return (
    <Section
      style={{
        backgroundColor: palette.background,
        border: `1px solid ${palette.border}`,
        borderRadius: '6px',
        padding: '14px',
        marginTop: '16px',
      }}
    >
      <Row>
        <Column style={{ width: '32px', verticalAlign: 'top' }}>
          <EmailIcon name={palette.icon} />
        </Column>
        <Column style={{ verticalAlign: 'top' }}>
          <Text style={{ ...text, fontWeight: 600 }}>{title}</Text>
          {children && <Text style={text}>{children}</Text>}
        </Column>
      </Row>
    </Section>
  )
}
