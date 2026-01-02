import { Button, Section, Text } from '@react-email/components'
import * as React from 'react'
import type { InconclusiveEmailData } from '@/collections/DrugTests/email/types'
import { ClientIdentity, DetailRow, EmailLayout } from './components'
import { formatDate, formatTestType } from './utils/formatters'
import { warningBox, button } from './utils/styles'

/**
 * InconclusiveEmail (Client Version)
 * Sent when a test sample is invalid and cannot be screened
 * Includes dashboard link to reschedule
 */
export function InconclusiveEmail(data: InconclusiveEmailData) {
  const { clientName, collectionDate, testType, reason, clientHeadshotDataUri, clientDob } = data

  return (
    <EmailLayout preview="Your drug test sample could not be screened" title="⚠️ Test Inconclusive">
      <ClientIdentity
        headshotDataUri={clientHeadshotDataUri}
        name={clientName}
        dob={clientDob}
      />

      <Section style={warningBox}>
        <Text style={{ margin: '0 0 8px 0', fontWeight: 700 }}>
          Your drug test sample could not be screened.
        </Text>
        <Text style={{ margin: '0' }}>
          The sample was invalid and unable to produce test results.{' '}
          {reason
            ? `Reason: ${reason}`
            : 'This may occur if the sample leaked during transport, was damaged, or was otherwise compromised.'}
        </Text>
      </Section>

      <Section style={{ marginBottom: '24px' }}>
        <Text
          style={{
            fontSize: '18px',
            fontWeight: 700,
            color: '#1f2937',
            margin: '0 0 12px 0',
          }}
        >
          Test Information
        </Text>
        <DetailRow label="Collection Date" value={formatDate(collectionDate)} />
        <DetailRow label="Test Type" value={formatTestType(testType)} />
      </Section>

      <Text
        style={{
          fontSize: '16px',
          lineHeight: '24px',
          color: '#374151',
          marginBottom: '24px',
        }}
      >
        A new test will need to be scheduled to obtain valid results. Please contact MI Drug Test
        to schedule a replacement test.
      </Text>

      <Section style={{ textAlign: 'center', marginBottom: '24px' }}>
        <Button
          href={`${process.env.NEXT_PUBLIC_SERVER_URL}/dashboard/results`}
          style={button}
        >
          View Test History
        </Button>
      </Section>

      <Section
        style={{
          backgroundColor: '#f9fafb',
          padding: '16px',
          borderRadius: '8px',
        }}
      >
        <Text style={{ margin: '0 0 8px 0', fontWeight: 700 }}>
          Please call us to schedule a replacement test.
        </Text>
        <Text style={{ margin: '0', fontSize: '12px', color: '#6b7280' }}>
          This is an automated notification from MI Drug Test.
        </Text>
        <Text style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#6b7280' }}>
          Notification sent: {formatDate(new Date().toISOString())}
        </Text>
      </Section>
    </EmailLayout>
  )
}

InconclusiveEmail.PreviewProps = {
  clientName: 'John Doe',
  collectionDate: '2025-12-10T14:30:00Z',
  testType: '11-panel-lab',
  reason: 'Sample leaked during transport',
  breathalyzerTaken: false,
  breathalyzerResult: null,
  clientHeadshotDataUri: 'https://via.placeholder.com/120',
  clientDob: '1990-05-15',
} satisfies InconclusiveEmailData

export default InconclusiveEmail
