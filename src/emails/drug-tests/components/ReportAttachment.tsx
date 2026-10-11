import { Column, Row, Section, Text } from '@react-email/components'
import * as React from 'react'
import { colors, text } from '../utils/theme'
import { EmailIcon } from './EmailIcon'

export function ReportAttachment({ filename = 'Lab report.pdf' }: { filename?: string }) {
  return (
    <Section style={{ borderTop: `1px solid ${colors.border}`, marginTop: '20px', paddingTop: '16px' }}>
      <Row>
        <Column style={{ width: '32px', verticalAlign: 'top' }}>
          <EmailIcon name="file-text-gray" />
        </Column>
        <Column>
          <Text style={{ ...text, fontWeight: 600 }}>{filename}</Text>
          <Text style={{ ...text, color: colors.muted }}>Attached to this email</Text>
        </Column>
      </Row>
    </Section>
  )
}
