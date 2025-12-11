import { Section, Text } from '@react-email/components'
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
import { errorBox } from './utils/styles'

/**
 * CompleteEmailReferral (Referral Version)
 * Sent to referrals when all confirmation testing is complete
 * No dashboard link, includes client context
 */
export function CompleteEmailReferral(data: CompleteEmailData) {
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
    <EmailLayout
      preview={`Final drug test results for ${clientName}`}
      title="Final Drug Test Results"
    >
      <ResultBadge result={finalStatus} />

      <ClientIdentity
        headshotDataUri={clientHeadshotDataUri}
        name={clientName}
        dob={clientDob}
      />

      <Section style={{ marginBottom: '24px' }}>
        <DetailRow label="Client" value={clientName} />
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

      <Section
        style={{
          backgroundColor: '#f9fafb',
          padding: '16px',
          borderRadius: '6px',
          textAlign: 'center',
        }}
      >
        <Text style={{ margin: '0 0 8px 0', fontWeight: 700 }}>
          Complete test report is attached to this email.
        </Text>
        <Text style={{ margin: '0', fontSize: '12px', color: '#6b7280' }}>
          All testing is now complete for this client.
        </Text>
        <Text style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#6b7280' }}>
          Notification sent: {new Date().toLocaleString()}
        </Text>
      </Section>
    </EmailLayout>
  )
}

CompleteEmailReferral.PreviewProps = {
  clientName: 'Robert Brown',
  collectionDate: '2025-12-05T10:00:00Z',
  testType: '17-panel-sos-lab',
  initialScreenResult: 'unexpected-positive',
  confirmationResults: [
    { substance: 'thc', result: 'positive', notes: 'Confirmed at 25 ng/mL' },
  ],
  finalStatus: 'unexpected-positive',
  isDilute: true,
  breathalyzerTaken: false,
  breathalyzerResult: null,
  clientHeadshotDataUri: 'https://via.placeholder.com/120',
  clientDob: '1975-07-14',
  detectedSubstances: ['thc'],
  expectedPositives: [],
  unexpectedPositives: ['thc'],
  unexpectedNegatives: [],
} satisfies CompleteEmailData

export default CompleteEmailReferral
