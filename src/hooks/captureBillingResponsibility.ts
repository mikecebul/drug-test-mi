import type { CollectionBeforeChangeHook } from 'payload'
import { payerRelationshipId, resolveBillingResponsibility } from '@/lib/referral-invoices/payer'

/** New records get a server-resolved snapshot. Existing history is never backfilled by ordinary edits. */
export const captureBookingBillingResponsibility: CollectionBeforeChangeHook = async ({
  data,
  operation,
  req,
  originalDoc,
}) => {
  const changedClient =
    operation === 'update' &&
    data.relatedClient !== undefined &&
    payerRelationshipId(data.relatedClient) !== payerRelationshipId(originalDoc?.relatedClient)
  if (operation !== 'create' && !changedClient) return data
  if (
    changedClient &&
    payerRelationshipId(originalDoc?.relatedClient) &&
    (originalDoc?.billingResponsibility?.paymentOperationId ||
      originalDoc?.payment?.collectedAt ||
      (originalDoc?.payment?.amountPaid || 0) > 0 ||
      originalDoc?.sampleCollection?.status === 'collected')
  )
    throw new Error('The client cannot change after payment or collection. Review the saved record instead.')
  const clientId = payerRelationshipId(data.relatedClient)
  if (!clientId) {
    data.billingResponsibility = undefined
    return data
  }
  data.billingResponsibility = await resolveBillingResponsibility(
    req.payload,
    { payment: data.payment || originalDoc?.payment },
    clientId,
    req,
    true,
  )
  return data
}

export const captureTestBillingResponsibility: CollectionBeforeChangeHook = async ({ data, operation, req }) => {
  if (operation !== 'create') return data
  const clientId = payerRelationshipId(data.relatedClient)
  if (!clientId) throw new Error('A client is required to assign test billing.')
  const bookingId = payerRelationshipId(data.sourceBooking)
  if (bookingId) {
    const booking = await req.payload.findByID({
      collection: 'bookings',
      id: bookingId,
      depth: 0,
      overrideAccess: true,
      req,
    })
    if (payerRelationshipId(booking.relatedClient) !== clientId)
      throw new Error('The booking belongs to another client.')
    data.billingResponsibility = await resolveBillingResponsibility(req.payload, booking, clientId, req, true)
  } else {
    data.billingResponsibility = await resolveBillingResponsibility(req.payload, {}, clientId, req)
  }
  return data
}
