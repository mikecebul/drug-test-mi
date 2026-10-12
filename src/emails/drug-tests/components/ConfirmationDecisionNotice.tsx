import * as React from 'react'
import type { ScreenedEmailData } from '@/collections/DrugTests/email/types'
import { formatEmailDate } from '../utils/formatters'
import { Notice } from './Notice'

type ConfirmationDecisionNoticeProps = Pick<
  ScreenedEmailData,
  | 'confirmationDecision'
  | 'confirmationCompleted'
  | 'confirmationSubstances'
  | 'confirmationPaymentRequired'
  | 'confirmationHoldUntil'
  | 'testType'
  | 'unexpectedPositives'
> & { confirmationWindowClosed?: boolean }

export function ConfirmationDecisionNotice({
  confirmationDecision,
  confirmationCompleted,
  confirmationSubstances,
  confirmationPaymentRequired,
  confirmationHoldUntil,
  testType,
  unexpectedPositives,
  confirmationWindowClosed = false,
}: ConfirmationDecisionNoticeProps) {
  const isRequested = confirmationDecision === 'request-confirmation'
  if (!unexpectedPositives.length && !confirmationSubstances?.length && !isRequested && !confirmationCompleted)
    return null

  if (confirmationCompleted)
    return (
      <Notice title="Confirmation complete" tone="success">
        Final report attached.
      </Notice>
    )
  if (confirmationDecision === 'accept')
    return (
      <Notice title="Screening result accepted" tone="neutral">
        No confirmation requested.
      </Notice>
    )

  const isInstant = testType.endsWith('-instant')
  const price = isInstant ? '$30' : '$45'
  const deadline =
    confirmationHoldUntil && Number.isFinite(new Date(confirmationHoldUntil).getTime()) ? confirmationHoldUntil : null
  if (confirmationWindowClosed && (!isRequested || confirmationPaymentRequired)) {
    return (
      <Notice title="Confirmation window closed" tone="error">
        Contact Mike for next steps.
      </Notice>
    )
  }
  const window = deadline
    ? `${confirmationPaymentRequired ? 'Pay' : 'Request'} by ${formatEmailDate(deadline)}`
    : isInstant
      ? 'Request before specimen disposal.'
      : 'Request within 30 days of the screening result date.'

  if (isRequested) {
    return confirmationPaymentRequired ? (
      <Notice title="Payment needed">
        {price} per substance · {window}
        <br />
        Lab request after payment.
      </Notice>
    ) : (
      <Notice title="Confirmation selected">Staff coordinating with the lab. Final result pending.</Notice>
    )
  }
  return (
    <Notice title="Confirmation available">
      {price} per substance · {window}
    </Notice>
  )
}
