import { Section, Text } from '@react-email/components'
import * as React from 'react'
import type { CollectedEmailData } from '@/collections/DrugTests/email/types'
import { BreathalyzerResult, ClientIdentity, DetailRow, EmailLayout } from './components'
import { formatDate, formatTestType } from './utils/formatters'

/**
 * CollectedEmail (Referrals Only)
 * Sent when a lab test sample is collected and sent to the lab
 * Only sent to referrals - clients don't receive this notification
 */
export function CollectedEmail(data: CollectedEmailData) {
  const {
    clientName,
    collectionDate,
    testType,
    breathalyzerTaken,
    breathalyzerResult,
    clientHeadshotDataUri,
    clientDob,
  } = data

  return (
    <EmailLayout
      preview={`Drug test sample collected for ${clientName}`}
      title="Drug Test Sample Collected"
    >
      <ClientIdentity
        headshotDataUri={clientHeadshotDataUri}
        name={clientName}
        dob={clientDob}
      />

      <Text
        style={{
          fontSize: '16px',
          lineHeight: '24px',
          color: '#374151',
          marginBottom: '24px',
        }}
      >
        A drug test sample has been collected and is being sent to the laboratory for screening:
      </Text>

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

      {breathalyzerTaken && breathalyzerResult !== null && (
        <BreathalyzerResult
          bac={breathalyzerResult}
          result={breathalyzerResult > 0.0 ? 'positive' : 'negative'}
        />
      )}

      <Text
        style={{
          fontSize: '16px',
          lineHeight: '24px',
          color: '#374151',
          marginBottom: '24px',
        }}
      >
        You will receive another notification when laboratory results are available.
      </Text>

      <Section
        style={{
          backgroundColor: '#f9fafb',
          padding: '16px',
          borderRadius: '8px',
        }}
      >
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

CollectedEmail.PreviewProps = {
  clientName: 'Mike Johnson',
  collectionDate: '2025-12-10T14:30:00Z',
  testType: '11-panel-lab',
  breathalyzerTaken: true,
  breathalyzerResult: 0.0,
  clientHeadshotDataUri: 'https://via.placeholder.com/120',
  clientDob: '1992-03-10',
} satisfies CollectedEmailData

export default CollectedEmail
