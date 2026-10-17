import { randomUUID } from 'node:crypto'
import type { CollectionBeforeChangeHook, CollectionAfterChangeHook } from 'payload'
import {
  confirmationHoldUntil,
  knownScreeningDate,
  confirmationPaid,
  confirmationRemaining,
  referralPaysConfirmation,
} from './policy'

/** The first screening timestamp is stable across edits, resends, and payment updates. */
export const captureConfirmationState: CollectionBeforeChangeHook = ({ data, originalDoc, req }) => {
  if (!data) return data
  const known = originalDoc && knownScreeningDate(originalDoc)
  if (known) data.screenedAt = known
  else if (
    !data.screenedAt &&
    !originalDoc?.initialScreenResult &&
    (data.screeningStatus === 'screened' || (data.testDocument && data.screeningStatus !== 'collected'))
  )
    data.screenedAt = new Date().toISOString()
  if (data.screenedAt && !known && new Date(data.screenedAt).getTime() > Date.now() + 60_000)
    throw new Error('The screening result date cannot be in the future.')
  if (data.screenedAt) data.confirmationHoldUntil = confirmationHoldUntil(data.screenedAt)
  // A trusted allocator records the fee contribution explicitly; other account payments pay base debt first.
  if (data.payment && !req.context.confirmationAllocation) {
    const previous = confirmationPaid(originalDoc || {})
    const paid = data.payment.amountPaid || 0
    const base = Math.max(0, (data.payment.amountDue || 0) - (data.payment.confirmationFeeDue || 0))
    data.payment.confirmationFeePaid = Math.min(
      data.payment.confirmationFeeDue || 0,
      Math.max(previous, paid - base, 0),
    )
  }
  const current = { ...originalDoc, ...data }
  const wasFunded = !!originalDoc?.payment?.confirmationFeeDue && confirmationRemaining(originalDoc) === 0
  const funded =
    current.confirmationDecision === 'request-confirmation' &&
    (current.payment?.confirmationFeeDue || 0) > 0 &&
    confirmationRemaining(current) === 0 &&
    !referralPaysConfirmation(current)
  if (!funded) {
    data.confirmationPaidNotificationKey = null
    data.confirmationPaidNotifiedAt = null
  } else if (!wasFunded || originalDoc?.confirmationDecision !== 'request-confirmation') {
    data.confirmationPaidNotificationKey = randomUUID()
    data.confirmationPaidNotifiedAt = null
  }
  return data
}

/** Queue in the same DB transaction as the payment; failed delivery is retried by the worker. */
export const queueConfirmationPaidNotification: CollectionAfterChangeHook = async ({ doc, previousDoc, req }) => {
  if (
    doc.confirmationRequestKey &&
    doc.confirmationNotificationAdmin &&
    doc.confirmationPaidNotificationKey &&
    doc.confirmationPaidNotificationKey !== previousDoc?.confirmationPaidNotificationKey
  ) {
    await req.payload.jobs.queue({
      task: 'notify-confirmation-paid',
      queue: 'redwood',
      req,
      input: { testId: doc.id, notificationKey: doc.confirmationPaidNotificationKey },
    })
  }
  return doc
}
