import { Section, Text } from '@react-email/components'
import * as React from 'react'
import { formatSubstance } from '../utils/formatters'
import { warningBox } from '../utils/styles'

type ConfirmationDecision = 'accept' | 'request-confirmation' | 'pending-decision' | null | undefined

type ConfirmationDecisionNoticeProps = {
  audience: 'client' | 'referral'
  confirmationDecision?: ConfirmationDecision
  testType: string
  unexpectedPositives: string[]
}

function formatSubstanceList(substances: string[]) {
  return substances.map(formatSubstance).join(', ')
}

export function ConfirmationDecisionNotice({
  audience,
  confirmationDecision,
  testType,
  unexpectedPositives,
}: ConfirmationDecisionNoticeProps) {
  if (unexpectedPositives.length === 0) return null

  const isClient = audience === 'client'
  const isInstantTest = testType === '15-panel-instant' || testType === '17-panel-instant'
  const substances = formatSubstanceList(unexpectedPositives)
  const confirmationWindow = isInstantTest ? '30 days' : '60 days'
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
