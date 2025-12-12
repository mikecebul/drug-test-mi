import { Button, Section, Text } from '@react-email/components'
import * as React from 'react'
import type { CompleteEmailData } from '@/collections/DrugTests/email/types'
import {
  BreathalyzerResult,
  ClientIdentity,
  ConfirmationSection,
  DetailRow,
  EmailLayout,
  ResultBadge,
} from './components'
import { formatDate, formatTestType } from './utils/formatters'
import { getResultLabel } from './utils/constants'
import { button, errorBox } from './utils/styles'

/**
 * CompleteEmail (Client Version)
 * Sent when all confirmation testing is complete
 * Includes dashboard link to view full report
 */
export function CompleteEmail(data: CompleteEmailData) {
  const {
    clientName,
    collectionDate,
    testType,
    initialScreenResult,
    confirmationResults,
    finalStatus,
    isDilute,
    breathalyzerTaken,
    breathalyzerResult,
    clientHeadshotDataUri,
    clientDob,
  } = data

  return (
    <EmailLayout preview="Your final drug test results are ready" title="Final Drug Test Results">
      <ResultBadge result={finalStatus} />

      <ClientIdentity
        headshotDataUri={clientHeadshotDataUri}
        name={clientName}
        dob={clientDob}
      />

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
        <DetailRow label="Initial Screen Result" value={getResultLabel(initialScreenResult)} />
      </Section>

      {isDilute && (
        <Section style={errorBox}>
          <Text style={{ margin: '0 0 4px 0', fontWeight: 700 }}>⚠️ DILUTE SAMPLE</Text>
          <Text style={{ margin: '0' }}>
            This sample was dilute and may affect result accuracy.
          </Text>
        </Section>
      )}

      {breathalyzerTaken && breathalyzerResult !== null && (
        <BreathalyzerResult bac={breathalyzerResult} result={breathalyzerResult > 0.0 ? 'positive' : 'negative'} />
      )}

      <ConfirmationSection confirmationResults={confirmationResults} />

      <Section style={{ textAlign: 'center', marginBottom: '24px' }}>
        <Button
          href={`${process.env.NEXT_PUBLIC_SERVER_URL}/dashboard/results`}
          style={button}
        >
          View Test Results
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
          Your complete test report is attached to this email.
        </Text>
        <Text style={{ margin: '0', fontSize: '12px', color: '#6b7280' }}>
          All testing is now complete. If you have questions, please contact MI Drug Test.
        </Text>
        <Text style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#6b7280' }}>
          Notification sent: {new Date().toLocaleString()}
        </Text>
      </Section>
    </EmailLayout>
  )
}

CompleteEmail.PreviewProps = {
  clientName: 'Sarah Williams',
  collectionDate: '2025-12-05T10:00:00Z',
  testType: '11-panel-lab',
  initialScreenResult: 'unexpected-positive',
  confirmationResults: [
    { substance: 'thc', result: 'negative', notes: 'Below detection limit' },
    { substance: 'cocaine', result: 'positive', notes: 'Confirmed at 150 ng/mL' },
  ],
  finalStatus: 'mixed-unexpected',
  isDilute: false,
  breathalyzerTaken: true,
  breathalyzerResult: 0.0,
  clientHeadshotDataUri: 'https://via.placeholder.com/120',
  clientDob: '1988-11-20',
  detectedSubstances: ['thc', 'cocaine'],
  expectedPositives: [],
  unexpectedPositives: ['thc', 'cocaine'],
  unexpectedNegatives: [],
} satisfies CompleteEmailData

export default CompleteEmail
