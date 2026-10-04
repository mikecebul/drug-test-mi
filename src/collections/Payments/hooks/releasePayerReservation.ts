import type { CollectionAfterChangeHook } from 'payload'
import { payerRelationshipId } from '@/lib/referral-invoices/payer'
import { releaseClientPaymentPayer } from '@/lib/referral-invoices/booking-payer'

export const releasePayerReservation: CollectionAfterChangeHook = async ({ doc, req }) => {
  const bookingId = payerRelationshipId(doc.relatedBooking)
  if (
    bookingId &&
    doc.workflowOperationId &&
    (doc.stripeTerminalStatus === 'failed' || doc.stripeTerminalStatus === 'cancelled' || doc.status === 'posted')
  ) {
    await releaseClientPaymentPayer(req.payload, bookingId, doc.workflowOperationId, req)
  }
  return doc
}
