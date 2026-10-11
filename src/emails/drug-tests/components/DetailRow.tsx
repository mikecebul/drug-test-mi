import { Column, Row } from '@react-email/components'
import * as React from 'react'
import { colors, text } from '../utils/theme'

export function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Row>
      <Column style={{ ...text, width: '100px', color: colors.muted, padding: '2px 12px 2px 0', verticalAlign: 'top' }}>
        {label}:
      </Column>
      <Column style={{ ...text, fontWeight: 600, padding: '2px 0', verticalAlign: 'top' }}>{value}</Column>
    </Row>
  )
}
