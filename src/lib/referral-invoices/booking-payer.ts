import type { Booking } from '@/payload-types'
import type { Payload, PayloadRequest } from 'payload'
import { withPayloadTransaction } from '@/collections/Payments/services/withPayloadTransaction'
import { payerRelationshipId, resolveBillingResponsibility, resolveClientBillingResponsibility } from './payer'

function nextUpdatedAt(previous: string) {
  return new Date(Math.max(Date.now(), new Date(previous).getTime() + 1)).toISOString()
}

export async function setCollectionPayer(input: {
  payload: Payload
  bookingId: string
  payer: 'client' | 'referral'
  expectedPayer: 'client' | 'referral'
  userId?: string
}) {
  return withPayloadTransaction(input.payload, async (req) => {
    const booking = await input.payload.findByID({
      collection: 'bookings',
      id: input.bookingId,
      depth: 0,
      overrideAccess: true,
      req,
    })
    const clientId = payerRelationshipId(booking.relatedClient)
    if (!clientId) throw new Error('Select the client first.')
    if (
      booking.sampleCollection?.status === 'collected' ||
      booking.payment?.collectedAt ||
      (booking.payment?.amountPaid || 0) > 0 ||
      booking.payment?.status === 'paid'
    )
      throw new Error('Billing cannot change after payment or collection. Review the saved record instead.')
    if (booking.billingResponsibility?.paymentOperationId)
      throw new Error('Wait for the card payment to finish or cancel it before changing billing.')
    const current = await resolveBillingResponsibility(input.payload, booking, clientId, req, true)
    if (current.payer !== input.expectedPayer) throw new Error('The payer changed. Refresh before trying again.')
    const eligible = await resolveClientBillingResponsibility(input.payload, clientId, req)
    if (input.payer === 'referral' && eligible.payer !== 'referral')
      throw new Error('This referral is not enabled for invoicing.')
    const tests = await input.payload.find({
      collection: 'drug-tests',
      where: { sourceBooking: { equals: input.bookingId } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
      req,
    })
    if (tests.docs.length) throw new Error('This collection already has a saved test.')
    // The adapter applies this predicate to the write itself; Payload's bulk update
    // selects records first, which cannot protect a standalone database from stale writes.
    const updated = await input.payload.db.updateOne({
      collection: 'bookings',
      where: { and: [{ id: { equals: input.bookingId } }, { updatedAt: { equals: booking.updatedAt } }] },
      data: {
        updatedAt: nextUpdatedAt(booking.updatedAt),
        billingResponsibility: {
          ...(input.payer === 'referral' ? eligible : { payer: 'client' as const, referral: null }),
          changedAt: new Date().toISOString(),
          changedBy: input.userId,
        },
      },
      req,
    })
    if (!updated) throw new Error('The booking changed. Refresh before trying again.')
    return (updated as unknown as Pick<Booking, 'billingResponsibility'>).billingResponsibility
  })
}

/** Reserve the same booking document that the payer switch writes, before contacting Stripe. */
export async function reserveClientPaymentPayer(
  payload: Payload,
  bookingId: string,
  clientId: string,
  operationId: string,
) {
  return withPayloadTransaction(payload, async (req) => {
    const booking = await payload.findByID({
      collection: 'bookings',
      id: bookingId,
      depth: 0,
      overrideAccess: true,
      req,
    })
    if (payerRelationshipId(booking.relatedClient) !== clientId)
      throw new Error('The booking client changed. Refresh before collecting payment.')
    const responsibility = await resolveBillingResponsibility(payload, booking, clientId, req, true)
    if (responsibility.payer === 'referral')
      throw new Error('This referral pays for the test. Record its payment on the referral invoice.')
    if (
      booking.billingResponsibility?.paymentOperationId &&
      booking.billingResponsibility.paymentOperationId !== operationId
    )
      throw new Error('Another card payment is already in progress.')
    const updated = await payload.db.updateOne({
      collection: 'bookings',
      where: { and: [{ id: { equals: bookingId } }, { updatedAt: { equals: booking.updatedAt } }] },
      data: {
        updatedAt: nextUpdatedAt(booking.updatedAt),
        billingResponsibility: {
          ...booking.billingResponsibility,
          ...responsibility,
          paymentOperationId: operationId,
        },
      },
      req,
    })
    if (!updated) throw new Error('The booking changed. Refresh before collecting payment.')
  })
}

export async function releaseClientPaymentPayer(
  payload: Payload,
  bookingId: string,
  operationId: string,
  req?: Partial<PayloadRequest>,
) {
  const booking = await payload.findByID({ collection: 'bookings', id: bookingId, depth: 0, overrideAccess: true, req })
  if (booking.billingResponsibility?.paymentOperationId !== operationId) return
  await payload.db.updateOne({
    collection: 'bookings',
    where: {
      and: [{ id: { equals: bookingId } }, { 'billingResponsibility.paymentOperationId': { equals: operationId } }],
    },
    data: {
      billingResponsibility: { ...booking.billingResponsibility, paymentOperationId: null },
      updatedAt: nextUpdatedAt(booking.updatedAt),
    },
    req,
  })
}
