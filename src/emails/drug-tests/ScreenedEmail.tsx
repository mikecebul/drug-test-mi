import { Button, Section, Text } from '@react-email/components'
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
import { button, errorBox, warningBox } from './utils/styles'

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
    detectedSubstances,
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

  const hasUnexpected =
    initialScreenResult === 'unexpected-positive' ||
    initialScreenResult === 'unexpected-negative-critical' ||
    initialScreenResult === 'unexpected-negative-warning' ||
    initialScreenResult === 'mixed-unexpected'

  const isInstantTest = testType === '15-panel-instant'
  const isLabScreen = testType !== '15-panel-instant'
  const hasConfirmationDecision = confirmationDecision !== null && confirmationDecision !== undefined
  const isAccepted = confirmationDecision === 'accept'
  const isPending = confirmationDecision === 'pending-decision'

  // Confirmation messaging helper
  const getConfirmationMessage = () => {
    if (!hasUnexpected) return null

    if (initialScreenResult === 'unexpected-negative-warning') {
      return (
        <Section style={{...warningBox, marginBottom: '24px'}}>
          <Text style={{ margin: '0 0 8px 0', fontWeight: 700 }}>⚠️ About Your Results</Text>
          <Text style={{ margin: '0 0 8px 0' }}>
            Your test shows that some of your prescribed medications were not detected. This is being monitored for patterns but does not automatically fail your test.
          </Text>
          <Text style={{ margin: '0' }}>
            <strong>Note:</strong> One-off missed medications are not uncommon and can be due to timing or other factors. Your referral source will review this as part of your ongoing monitoring.
          </Text>
        </Section>
      )
    }

    if (initialScreenResult === 'unexpected-negative-critical') {
      return (
        <Section style={{...errorBox, marginBottom: '24px'}}>
          <Text style={{ margin: '0 0 8px 0', fontWeight: 700 }}>‼️ Critical: Required Medication Missing</Text>
          <Text style={{ margin: '0 0 8px 0' }}>
            Your test shows that required medications (marked for strict monitoring) were not detected. This requires immediate review.
          </Text>
          <Text style={{ margin: '0' }}>
            <strong>Action Required:</strong> Your referral source has been notified and may request confirmation testing. Please contact them directly if you have questions.
          </Text>
        </Section>
      )
    }

    // Unexpected positive messaging
    if (isInstantTest && hasConfirmationDecision) {
      return isAccepted ? (
        <Section style={{...warningBox, marginBottom: '24px'}}>
          <Text style={{ margin: '0 0 8px 0', fontWeight: 700 }}>Results Accepted</Text>
          <Text style={{ margin: '0 0 8px 0' }}>
            You chose to accept these screening results as final at the time of collection. The sample has been disposed and confirmation testing is no longer available for this test.
          </Text>
          <Text style={{ margin: '0' }}>
            Please call us if you have questions about your results.
          </Text>
        </Section>
      ) : (
        <Section style={{...warningBox, marginBottom: '24px'}}>
          <Text style={{ margin: '0 0 8px 0', fontWeight: 700 }}>Confirmation Testing Requested</Text>
          <Text style={{ margin: '0 0 8px 0' }}>
            Your sample has been sent to the laboratory for LC-MS/MS confirmation testing on the unexpected positive substances. You will receive an update when confirmation results are available (typically 2-4 business days).
          </Text>
          <Text style={{ margin: '0' }}>
            Thank you for choosing confirmation testing to verify your results.
          </Text>
        </Section>
      )
    }

    if (isLabScreen && hasConfirmationDecision) {
      if (isAccepted) {
        return (
          <Section style={{...warningBox, marginBottom: '24px'}}>
            <Text style={{ margin: '0 0 8px 0', fontWeight: 700 }}>Results Accepted</Text>
            <Text style={{ margin: '0 0 8px 0' }}>
              You have accepted these screening results as final. Your sample will be held by the laboratory for 30 days in case you change your mind and wish to request confirmation testing.
            </Text>
            <Text style={{ margin: '0' }}>
              Confirmation testing is available for <strong>$45 per substance</strong> within <strong>30 days</strong>. Please call us if you have questions.
            </Text>
          </Section>
        )
      }

      if (isPending) {
        return (
          <Section style={{...warningBox, marginBottom: '24px'}}>
            <Text style={{ margin: '0 0 8px 0', fontWeight: 700 }}>Confirmation Testing Available</Text>
            <Text style={{ margin: '0 0 8px 0' }}>
              We were unable to reach you about your screening results. Your sample is being held by the laboratory for <strong>30 days</strong> to give you the opportunity to request confirmation testing.
            </Text>
            <Text style={{ margin: '0' }}>
              Confirmation testing is available for <strong>$45 per substance</strong> within <strong>30 days</strong> to verify these results. Please call us at your earliest convenience to discuss your options.
            </Text>
          </Section>
        )
      }

      return (
        <Section style={{...warningBox, marginBottom: '24px'}}>
          <Text style={{ margin: '0 0 8px 0', fontWeight: 700 }}>Confirmation Testing Requested</Text>
          <Text style={{ margin: '0 0 8px 0' }}>
            Your sample has been sent to the laboratory for LC-MS/MS confirmation testing on the unexpected positive substances. You will receive an update when confirmation results are available (typically 2-4 business days).
          </Text>
          <Text style={{ margin: '0' }}>
            Thank you for choosing confirmation testing to verify your results.
          </Text>
        </Section>
      )
    }

    // Default: no decision yet
    return (
      <Section style={{...warningBox, marginBottom: '24px'}}>
        <Text style={{ margin: '0 0 8px 0', fontWeight: 700 }}>Confirmation Testing Available</Text>
        <Text style={{ margin: '0 0 8px 0' }}>
          Your initial screening detected unexpected substances. Confirmation testing is available for <strong>$45 per substance</strong> within <strong>30 days</strong> to verify these results.
        </Text>
        <Text style={{ margin: '0' }}>
          Please call us at your earliest convenience to discuss your results.
        </Text>
      </Section>
    )
  }

  return (
    <EmailLayout preview="Your drug test results are ready" title="Drug Test Results">
      <ResultBadge result={initialScreenResult} />

      <ClientIdentity
        headshotDataUri={clientHeadshotDataUri}
        name={clientName}
        dob={clientDob}
      />

      <Section style={{ marginBottom: '24px' }}>
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

      {getConfirmationMessage()}

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
          borderRadius: '6px',
          textAlign: 'center',
        }}
      >
        <Text style={{ margin: '0 0 8px 0', fontWeight: 700 }}>
          Your complete test report is attached to this email.
        </Text>
        <Text style={{ margin: '0', fontSize: '12px', color: '#6b7280' }}>
          If you have questions, please contact MI Drug Test.
        </Text>
        <Text style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#6b7280' }}>
          Notification sent: {new Date().toLocaleString()}
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
