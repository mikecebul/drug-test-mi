import { Column, Row, Section, Text } from '@react-email/components'
import * as React from 'react'
import { colors, text } from '../utils/theme'

export function ReportAttachment({ filename = 'Lab report.pdf' }: { filename?: string }) {
  return (
    <Section style={{ borderTop: `1px solid ${colors.border}`, marginTop: '20px', paddingTop: '16px' }}>
      <Row>
        <Column style={{ width: '32px', verticalAlign: 'top' }}>
          <Text aria-hidden="true" style={{ ...text, color: colors.muted }}>
            <span
              style={{
                display: 'inline-block',
                width: '16px',
                height: '20px',
                border: `2px solid ${colors.muted}`,
                borderRadius: '2px',
              }}
            >
              <span style={{ display: 'block', borderTop: `1px solid ${colors.muted}`, margin: '8px 3px 0' }} />
              <span style={{ display: 'block', borderTop: `1px solid ${colors.muted}`, margin: '3px 3px 0' }} />
            </span>
          </Text>
        </Column>
        <Column>
          <Text style={{ ...text, fontWeight: 600 }}>{filename}</Text>
          <Text style={{ ...text, color: colors.muted }}>Attached to this email</Text>
        </Column>
      </Row>
    </Section>
  )
}
