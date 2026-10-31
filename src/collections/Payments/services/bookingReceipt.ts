import type { Payload } from 'payload'

export async function hasPreviousBookingReceipt(payload: Payload, bookingId: string) {
  // Include receipts sent before the booking-level guard was introduced, as well
  // as Terminal receipts delivered by Stripe rather than our email adapter.
  const previousReceipts = await payload.find({
    collection: 'payments',
    where: {
      and: [
        { relatedBooking: { equals: bookingId } },
        {
          or: [
            { receiptEmailSentAt: { exists: true } },
            {
              and: [
                { method: { equals: 'stripe' } },
                { status: { in: ['posted', 'refunded'] } },
                { receiptEmail: { exists: true } },
              ],
            },
          ],
        },
      ],
    },
    depth: 0,
    limit: 1,
    overrideAccess: true,
  })
  return previousReceipts.docs.length > 0
}

/** Claim once for the entire visit, independently of payment-step operation IDs. */
export async function claimBookingReceipt(payload: Payload, bookingId: string) {
  if (await hasPreviousBookingReceipt(payload, bookingId)) return false

  // The adapter applies the predicate in the write itself. Local API bulk
  // updates first read matching documents and cannot provide this atomic claim.
  const claimed = await payload.db.updateOne({
    collection: 'bookings',
    where: {
      and: [{ id: { equals: bookingId } }, { receiptEmailClaimedAt: { exists: false } }],
    },
    data: { receiptEmailClaimedAt: new Date().toISOString() },
  })
  return Boolean(claimed)
}
