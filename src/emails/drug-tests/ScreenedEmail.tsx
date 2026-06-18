import { Button, Section, Text } from '@react-email/components'
import * as React from 'react'
import type { ScreenedEmailData } from '@/collections/DrugTests/email/types'
import {
  BreathalyzerResult,
  ClientIdentity,
  ConfirmationDecisionNotice,
  DetailRow,
  EmailLayout,
  ResultBadge,
  SubstancesSection,
} from './components'
import { formatDate, formatTestType } from './utils/formatters'
import { button, errorBox } from './utils/styles'

/**
 * ScreenedEmail (Client Version)
 * Sent when initial screening results are entered
 * Includes full results, dashboard link, and confirmation testing information
 */
export function ScreenedEmail(data: ScreenedEmailData) {
  const {
    clientName,
    collectionDate,
    testType,
    initialScreenResult,
    detectedSubstances: _detectedSubstances,
    expectedPositives,
    unexpectedPositives,
    unexpectedNegatives,
    isDilute,
    confirmationDecision,
    breathalyzerTaken,
    breathalyzerResult,
    clientHeadshotDataUri,
    clientDob,
  } = data

  return (
    <EmailLayout preview="Your drug test results are ready" title="Drug Test Results">
      <ResultBadge result={initialScreenResult} />

      <ClientIdentity headshotDataUri={clientHeadshotDataUri} name={clientName} dob={clientDob} />

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

      {isDilute && (
        <Section style={errorBox}>
          <Text style={{ margin: '0 0 4px 0', fontWeight: 700 }}>⚠️ DILUTE SAMPLE</Text>
          <Text style={{ margin: '0' }}>This sample was dilute and may affect result accuracy.</Text>
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

      <ConfirmationDecisionNotice
        audience="client"
        confirmationDecision={confirmationDecision}
        initialScreenResult={initialScreenResult}
        testType={testType}
        unexpectedPositives={unexpectedPositives}
        unexpectedNegatives={unexpectedNegatives}
      />

      <Section style={{ textAlign: 'center', marginBottom: '24px' }}>
        <Button href={`${process.env.NEXT_PUBLIC_SERVER_URL}/dashboard/results`} style={button}>
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
          If you have questions, please contact MI Drug Test.
        </Text>
        <Text style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#6b7280' }}>
          Notification sent: {formatDate(new Date().toISOString())}
        </Text>
      </Section>
    </EmailLayout>
  )
}

ScreenedEmail.PreviewProps = {
  clientName: 'Alex Thompson',
  collectionDate: '2025-12-08T09:30:00Z',
  testType: '11-panel-lab',
  initialScreenResult: 'unexpected-positive',
  detectedSubstances: ['benzodiazepines', 'thc'],
  expectedPositives: ['benzodiazepines'],
  unexpectedPositives: ['thc'],
  unexpectedNegatives: [],
  isDilute: false,
  confirmationDecision: 'pending-decision',
  breathalyzerTaken: true,
  breathalyzerResult: 0.0,
  clientHeadshotDataUri: 'https://via.placeholder.com/120',
  clientDob: '1995-04-12',
} satisfies ScreenedEmailData

export default ScreenedEmail
