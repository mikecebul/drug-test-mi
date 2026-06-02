'use server'

import type { getPayload } from 'payload'

type Payload = Awaited<ReturnType<typeof getPayload>>

type BookingPayment = {
  amountDue?: number | null
  amountPaid?: number | null
  status?: 'paid' | 'partial' | 'unpaid' | null
  notes?: string | null
}

function normalizePayment(payment?: BookingPayment | null, fallbackAmountDue = 0) {
  const amountDue = typeof payment?.amountDue === 'number' ? payment.amountDue : fallbackAmountDue
  const amountPaid =
    typeof payment?.amountPaid === 'number'
      ? payment.amountPaid
      : payment?.status === 'paid'
        ? amountDue
        : 0

  return {
    status: payment?.status || 'unpaid',
    amountDue,
    amountPaid,
    balanceDue: Math.max(0, amountDue - amountPaid),
    notes: payment?.notes || undefined,
  }
}

export async function getDrugTestPaymentSnapshot(input: {
  payload: Payload
  bookingId?: string | null
  fallbackAmountDue?: number
}) {
  if (!input.bookingId) {
    return {
      payment: normalizePayment(null, input.fallbackAmountDue),
    }
  }

  const booking = await input.payload.findByID({
    collection: 'bookings',
    id: input.bookingId,
    depth: 0,
    overrideAccess: true,
  })

  return {
    sourceBooking: booking.id,
    payment: normalizePayment(booking.payment, input.fallbackAmountDue),
  }
}
