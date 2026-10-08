import { Section, Text } from '@react-email/components'
import * as React from 'react'
import { formatSubstance } from '../utils/formatters'
import { errorBox, warningBox } from '../utils/styles'

type ConfirmationDecision = 'accept' | 'request-confirmation' | 'pending-decision' | null | undefined

type ConfirmationDecisionNoticeProps = {
  audience: 'client' | 'referral'
  confirmationDecision?: ConfirmationDecision
  confirmationCompleted?: boolean
  confirmationSubstances?: string[]
  confirmationPaymentRequired?: boolean
  confirmationHoldUntil?: string | null
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
  confirmationCompleted,
  confirmationSubstances,
  confirmationPaymentRequired,
  confirmationHoldUntil,
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
  const confirmationWindow = confirmationHoldUntil
    ? `the laboratory hold ends ${new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'America/New_York' }).format(new Date(confirmationHoldUntil))}`
    : '30 days from the screening result date'
  const confirmationPrice = isInstantTest ? '$30' : '$45'

  let title = 'Confirmation Decision Pending'
  let message = isClient
    ? `Waiting on your decision to get confirmation testing for ${substances}.`
    : `Waiting on the client's decision to get confirmation testing for ${substances}.`
  let detail = isClient
    ? `Confirmation costs ${confirmationPrice} per substance; ${confirmationWindow}.`
    : `Confirmation costs ${confirmationPrice} per substance; ${confirmationWindow}.`

  if (confirmationDecision === 'accept') {
    title = 'Screen Results Accepted'
    message = isClient
      ? `You accepted the screen result for ${substances} without confirmation testing.`
      : `The client accepted the screen result for ${substances} without confirmation testing.`
    detail = isInstantTest
      ? 'The sample has been disposed and confirmation testing is no longer available for this test.'
      : 'This test is finished and is no longer tracked for confirmation.'
  }

  if (confirmationDecision === 'request-confirmation') {
    title = confirmationCompleted
      ? 'Confirmation Results Received'
      : confirmationPaymentRequired
        ? 'Confirmation Payment Required'
        : 'Confirmation Testing Selected'
    const selected = formatSubstanceList(confirmationSubstances?.length ? confirmationSubstances : unexpectedPositives)
    message = isClient
      ? `You selected confirmation testing for ${selected}.`
      : `The client selected confirmation testing for ${selected}.`
    detail = confirmationCompleted
      ? 'Confirmation results are included in this report.'
      : confirmationPaymentRequired
        ? 'Staff will request confirmation from the laboratory after payment clears. A final result will be sent when confirmation is complete.'
        : 'Staff will coordinate confirmation with the laboratory. A final result will be sent when confirmation is complete.'
  }

  return (
    <Section style={{ ...warningBox, marginBottom: '24px' }}>
      <Text style={{ margin: '0 0 8px 0', fontWeight: 700 }}>{title}</Text>
      <Text style={{ margin: '0 0 8px 0' }}>{message}</Text>
      <Text style={{ margin: '0' }}>{detail}</Text>
    </Section>
  )
}
