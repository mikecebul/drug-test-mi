import { Section, Text } from '@react-email/components'
import * as React from 'react'
import type { ScreenedEmailData } from '@/collections/DrugTests/email/types'
import {
  BreathalyzerResult,
  ClientIdentity,
  DetailRow,
  EmailLayout,
  ResultBadge,
  SubstancesSection,
} from './components'
import { formatDate, formatTestType } from './utils/formatters'
import { errorBox } from './utils/styles'

/**
 * ScreenedEmailReferral (Referral Version)
 * Sent to referrals when initial screening results are entered
 * No dashboard link, includes client context and full results
 */
export function ScreenedEmailReferral(data: ScreenedEmailData) {
  const {
    clientName,
    collectionDate,
    testType,
    initialScreenResult,
    expectedPositives,
    unexpectedPositives,
    unexpectedNegatives,
    isDilute,
    breathalyzerTaken,
    breathalyzerResult,
    clientHeadshotDataUri,
    clientDob,
  } = data

  return (
    <EmailLayout
      preview={`Drug test results for ${clientName}`}
      title="Drug Test Results"
    >
      <ResultBadge result={initialScreenResult} />

      <ClientIdentity
        headshotDataUri={clientHeadshotDataUri}
        name={clientName}
        dob={clientDob}
      />

      <Section style={{ marginBottom: '24px' }}>
        <DetailRow label="Client" value={clientName} />
        <DetailRow label="Collection Date" value={formatDate(collectionDate)} />
        <DetailRow label="Test Type" value={formatTestType(testType)} />
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

      <SubstancesSection
        expectedPositives={expectedPositives}
        unexpectedPositives={unexpectedPositives}
        unexpectedNegatives={unexpectedNegatives}
      />

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
          This is an automated notification from MI Drug Test.
        </Text>
        <Text style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#6b7280' }}>
          Notification sent: {new Date().toLocaleString()}
        </Text>
      </Section>
    </EmailLayout>
  )
}

ScreenedEmailReferral.PreviewProps = {
  clientName: 'Taylor Martinez',
  collectionDate: '2025-12-08T09:30:00Z',
  testType: '17-panel-sos-lab',
  initialScreenResult: 'mixed-unexpected',
  detectedSubstances: ['opiates', 'thc', 'benzodiazepines'],
  expectedPositives: ['opiates'],
  unexpectedPositives: ['thc'],
  unexpectedNegatives: ['benzodiazepines'],
  isDilute: true,
  confirmationDecision: null,
  breathalyzerTaken: false,
  breathalyzerResult: null,
  clientHeadshotDataUri: 'https://via.placeholder.com/120',
  clientDob: '1982-09-25',
} satisfies ScreenedEmailData

export default ScreenedEmailReferral
