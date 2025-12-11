import { Section, Text } from '@react-email/components'
import * as React from 'react'
import type { InconclusiveEmailData } from '@/collections/DrugTests/email/types'
import { ClientIdentity, DetailRow, EmailLayout } from './components'
import { formatDate, formatTestType } from './utils/formatters'
import { warningBox } from './utils/styles'

/**
 * InconclusiveEmailReferral (Referral Version)
 * Sent to referrals when a test sample is invalid
 * No dashboard link, includes client context
 */
export function InconclusiveEmailReferral(data: InconclusiveEmailData) {
  const { clientName, collectionDate, testType, reason, clientHeadshotDataUri, clientDob } = data

  return (
    <EmailLayout
      preview={`Drug test sample for ${clientName} could not be screened`}
      title="⚠️ Test Inconclusive"
    >
      <ClientIdentity
        headshotDataUri={clientHeadshotDataUri}
        name={clientName}
        dob={clientDob}
      />

      <Section style={warningBox}>
        <Text style={{ margin: '0 0 8px 0', fontWeight: 700 }}>
          Drug test sample could not be screened.
        </Text>
        <Text style={{ margin: '0' }}>
          The sample was invalid and unable to produce test results.{' '}
          {reason
            ? `Reason: ${reason}`
            : 'This may occur if the sample leaked during transport, was damaged, or was otherwise compromised.'}
        </Text>
      </Section>

      <Section style={{ marginBottom: '24px' }}>
        <DetailRow label="Client" value={clientName} />
        <DetailRow label="Collection Date" value={formatDate(collectionDate)} />
        <DetailRow label="Test Type" value={formatTestType(testType)} />
      </Section>

      <Text
        style={{
          fontSize: '16px',
          lineHeight: '24px',
          color: '#374151',
          fontWeight: 700,
          marginBottom: '24px',
        }}
      >
        Action Required: A new test will need to be scheduled for this client to obtain valid
        results.
      </Text>

      <Section
        style={{
          backgroundColor: '#f9fafb',
          padding: '16px',
          borderRadius: '6px',
          textAlign: 'center',
        }}
      >
        <Text style={{ margin: '0 0 8px 0', fontWeight: 700 }}>
          This test is marked as complete with an inconclusive result.
        </Text>
        <Text style={{ margin: '0', fontSize: '12px', color: '#6b7280' }}>
          This is an automated notification from MI Drug Test.
        </Text>
        <Text style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#6b7280' }}>
          Notification sent: {new Date().toLocaleString()}
        </Text>
      </Section>
    </EmailLayout>
  )
}

InconclusiveEmailReferral.PreviewProps = {
  clientName: 'Jane Smith',
  collectionDate: '2025-12-10T14:30:00Z',
  testType: '17-panel-sos-lab',
  reason: 'Sample was damaged in transit',
  breathalyzerTaken: false,
  breathalyzerResult: null,
  clientHeadshotDataUri: 'https://via.placeholder.com/120',
  clientDob: '1985-08-22',
} satisfies InconclusiveEmailData

export default InconclusiveEmailReferral
