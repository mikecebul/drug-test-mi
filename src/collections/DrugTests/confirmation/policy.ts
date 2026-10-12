/** Prices and funding rules shared by the workflow, ledger, and tracker. */
export const LAB_HOLD_DAYS = 30
export function confirmationPrice(testType: string) {
  return testType === '17-panel-instant' || testType === '15-panel-instant' ? 30 : 45
}
const money = (value?: number | null) => Math.max(0, Math.round((value || 0) * 100) / 100)
export type ConfirmationAccount = {
  billingResponsibility?: { payer?: string | null } | null
  confirmationDecision?: string | null
  screenedAt?: string | null
  confirmationHoldUntil?: string | null
  payment?: {
    amountDue?: number | null
    amountPaid?: number | null
    balanceDue?: number | null
    status?: string | null
    referralInvoice?: unknown
    confirmationFeeDue?: number | null
    confirmationFeePaid?: number | null
    confirmationPaymentBypassed?: boolean | null
  } | null
}
export function referralPaysConfirmation(test: ConfirmationAccount) {
  return (
    test.billingResponsibility?.payer === 'referral' ||
    test.payment?.status === 'invoiced' ||
    !!test.payment?.referralInvoice
  )
}
export function confirmationPaid(test: ConfirmationAccount) {
  const payment = test.payment
  // Older ledger entries did not distinguish the fee; treat payments beyond the base price as fee payments.
  return Math.min(
    money(payment?.confirmationFeeDue),
    money(
      payment?.confirmationFeePaid ??
        Math.max(
          0,
          money(payment?.amountPaid) - Math.max(0, money(payment?.amountDue) - money(payment?.confirmationFeeDue)),
        ),
    ),
  )
}
export function confirmationRemaining(test: ConfirmationAccount) {
  return money(money(test.payment?.confirmationFeeDue) - confirmationPaid(test))
}
export function confirmationPaymentRequired(test: ConfirmationAccount) {
  return (
    !referralPaysConfirmation(test) && !test.payment?.confirmationPaymentBypassed && confirmationRemaining(test) > 0
  )
}
export function confirmationHoldUntil(screenedAt: string) {
  const date = new Date(screenedAt)
  if (!Number.isFinite(date.getTime())) throw new Error('Enter a valid screening result date.')
  return new Date(date.getTime() + LAB_HOLD_DAYS * 24 * 60 * 60 * 1000).toISOString()
}
export function confirmationHoldExpired(test: Pick<ConfirmationAccount, 'confirmationHoldUntil'>, now = Date.now()) {
  return !!test.confirmationHoldUntil && new Date(test.confirmationHoldUntil).getTime() <= now
}

/** For legacy records, the first screening notice is the earliest evidence of availability. */
export function knownScreeningDate(test: {
  screenedAt?: string | null
  notificationsSent?: Array<{ stage?: string | null; sentAt?: string | null }> | null
}) {
  if (test.screenedAt) return test.screenedAt
  return test.notificationsSent
    ?.filter((n) => n.stage === 'screened' && n.sentAt && Number.isFinite(new Date(n.sentAt).getTime()))
    .map((n) => n.sentAt!)
    .sort()[0]
}
