import { Img, Section, Text } from '@react-email/components'
import * as React from 'react'
import { formatDob } from '../utils/formatters'

interface ClientIdentityProps {
  headshotDataUri?: string | null
  name: string
  dob?: string | null
}

/**
 * ClientIdentity displays client headshot, name, and date of birth
 * Headshot is displayed as a square image
 * Layout is left-aligned with notice about image availability
 */
export function ClientIdentity({ headshotDataUri, name, dob }: ClientIdentityProps) {
  return (
    <Section style={{ marginBottom: '24px' }}>
      {/* Client Headshot */}
      {headshotDataUri && (
        <>
          <Img
            src={headshotDataUri}
            alt={`${name} headshot`}
            width={120}
            height={120}
            style={{
              display: 'block',
              marginBottom: '0px',
              border: '2px solid #e5e7eb',
              borderRadius: '8px',
            }}
          />
          <Text
            style={{
              fontSize: '12px',
              color: '#6b7280',
              margin: '0 0 24px 0',
              fontStyle: 'italic',
            }}
          >
            Image available for 7 days
          </Text>
        </>
      )}

      {/* Client Name */}
      <Text
        style={{
          fontSize: '20px',
          fontWeight: 700,
          color: '#1f2937',
          margin: '0 0 4px 0',
        }}
      >
        {name}
      </Text>

      {/* Date of Birth */}
      {dob && (
        <Text
          style={{
            fontSize: '14px',
            color: '#6b7280',
            margin: '0',
          }}
        >
          DOB: {formatDob(dob)}
        </Text>
      )}
    </Section>
  )
}

ClientIdentity.PreviewProps = {
  name: 'John Doe',
  dob: '1990-05-15',
  headshotDataUri: 'https://via.placeholder.com/120',
} as ClientIdentityProps
