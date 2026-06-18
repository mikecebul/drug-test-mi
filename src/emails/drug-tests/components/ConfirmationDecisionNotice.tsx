import { Section, Text } from '@react-email/components'
import * as React from 'react'
import { formatSubstance } from '../utils/formatters'
import { errorBox, warningBox } from '../utils/styles'

type ConfirmationDecision = 'accept' | 'request-confirmation' | 'pending-decision' | null | undefined

type ConfirmationDecisionNoticeProps = {
  audience: 'client' | 'referral'
  confirmationDecision?: ConfirmationDecision
  initialScreenResult?: string | null
  testType: string
  unexpectedPositives: string[]
  unexpectedNegatives?: string[]
}

function formatSubstanceList(substances: string[]) {
  return substances.map(formatSubstance).join(', ')
}

export function ConfirmationDecisionNotice({
  audience,
  confirmationDecision,
  initialScreenResult,
  testType,
  unexpectedPositives,
  unexpectedNegatives = [],
}: ConfirmationDecisionNoticeProps) {
  const isClient = audience === 'client'

  if (
    unexpectedNegatives.length > 0 &&
    (initialScreenResult === 'unexpected-negative-critical' || initialScreenResult === 'unexpected-negative-warning')
  ) {
    const isCritical = initialScreenResult === 'unexpected-negative-critical'
    const substances = formatSubstanceList(unexpectedNegatives)
    const title = isCritical ? 'Unexpected Negative - Critical' : 'Unexpected Negative - Warning'
    const message = isClient
      ? `The screen did not detect ${substances}, which was expected based on current medication records.`
      : `The screen did not detect ${substances}, which was expected based on the client's medication records.`
    const detail = isCritical
      ? 'This result requires staff review because at least one missing expected substance is marked as confirmation-required.'
      : 'This result has been flagged for awareness because an expected substance was not detected.'

    return (
      <Section style={{ ...(isCritical ? errorBox : warningBox), marginBottom: '24px' }}>
        <Text style={{ margin: '0 0 8px 0', fontWeight: 700 }}>{title}</Text>
        <Text style={{ margin: '0 0 8px 0' }}>{message}</Text>
        <Text style={{ margin: '0' }}>{detail}</Text>
      </Section>
    )
  }

  if (unexpectedPositives.length === 0) return null

  const isInstantTest = testType === '15-panel-instant' || testType === '17-panel-instant'
  const substances = formatSubstanceList(unexpectedPositives)
  const confirmationWindow = '30 days'
  const confirmationPrice = isInstantTest ? '$30' : '$45'

  let title = 'Confirmation Decision Pending'
  let message = isClient
    ? `Waiting on your decision to get confirmation testing for ${substances}.`
    : `Waiting on the client's decision to get confirmation testing for ${substances}.`
  let detail = isClient
    ? `Confirmation is available for ${confirmationPrice} within ${confirmationWindow}.`
    : `Confirmation is available for ${confirmationPrice} within ${confirmationWindow}.`

  if (confirmationDecision === 'accept') {
    title = 'Screen Results Accepted'
    message = isClient
      ? `You accepted the screen result for ${substances} without confirmation testing.`
      : `The client accepted the screen result for ${substances} without confirmation testing.`
    detail = isInstantTest
      ? 'The sample has been disposed and confirmation testing is no longer available for this test.'
      : `The laboratory sample may still be eligible for confirmation within ${confirmationWindow}.`
  }

  if (confirmationDecision === 'request-confirmation') {
    title = 'Confirmation Testing Requested'
    message = isClient
      ? `You requested confirmation testing for ${substances}.`
      : `The client requested confirmation testing for ${substances}.`
    detail =
      'The sample has been sent to the laboratory for LC-MS/MS confirmation testing. A final result will be sent when confirmation is complete.'
  }

  return (
    <Section style={{ ...warningBox, marginBottom: '24px' }}>
      <Text style={{ margin: '0 0 8px 0', fontWeight: 700 }}>{title}</Text>
      <Text style={{ margin: '0 0 8px 0' }}>{message}</Text>
      <Text style={{ margin: '0' }}>{detail}</Text>
    </Section>
  )
}
