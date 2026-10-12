import { Column, Img, Row, Section, Text } from '@react-email/components'
import * as React from 'react'
import { formatEmailDob } from '../utils/formatters'
import { colors, text } from '../utils/theme'

interface ClientIdentityProps {
  headshotDataUri?: string | null
  name: string
  dob?: string | null
}

export function ClientIdentity({ headshotDataUri, name, dob }: ClientIdentityProps) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const initials = [parts[0]?.[0], parts.length > 1 ? parts.at(-1)?.[0] : ''].join('').toUpperCase()
  return (
    <Section style={{ marginBottom: '24px' }}>
      <Row>
        <Column style={{ width: '68px', verticalAlign: 'middle' }}>
          {headshotDataUri ? (
            <Img
              src={headshotDataUri}
              alt={`${name} headshot`}
              width={52}
              height={52}
              style={{ display: 'block', borderRadius: '50%', objectFit: 'cover' }}
            />
          ) : (
            <Text
              style={{
                ...text,
                width: '52px',
                height: '52px',
                lineHeight: '52px',
                borderRadius: '50%',
                backgroundColor: '#e5e7eb',
                textAlign: 'center',
                fontWeight: 600,
              }}
            >
              {initials}
            </Text>
          )}
        </Column>
        <Column style={{ verticalAlign: 'middle' }}>
          <Text style={{ ...text, fontSize: '24px', lineHeight: '30px', fontWeight: 700 }}>{name}</Text>
          {dob && <Text style={{ ...text, color: colors.muted }}>DOB {formatEmailDob(dob)}</Text>}
        </Column>
      </Row>
    </Section>
  )
}
