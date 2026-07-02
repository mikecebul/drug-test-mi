'use server'

import { getTestTypeByValue } from '@/config/test-types'
import type { getPayload } from 'payload'

type Payload = Awaited<ReturnType<typeof getPayload>>

type BookingPayment = {
  amountDue?: number | null
  amountPaid?: number | null
  method?: 'cash' | 'card' | 'not-paid' | 'pre-paid' | null
  status?: 'paid' | 'partial' | 'unpaid' | null
  notes?: string | null
}
type DrugTestPaymentMethod = 'cash' | 'card' | 'pre-paid' | 'stripe' | 'credit' | 'unknown'

function getFallbackAmountDue(testType?: string | null, fallbackAmountDue = 0) {
  if (typeof fallbackAmountDue === 'number' && fallbackAmountDue > 0) return fallbackAmountDue
  return getTestTypeByValue(testType)?.price || 0
}

function normalizePayment(payment?: BookingPayment | null, fallbackAmountDue = 0) {
  const amountDue = typeof payment?.amountDue === 'number' ? payment.amountDue : fallbackAmountDue
  const amountPaid =
    typeof payment?.amountPaid === 'number' ? payment.amountPaid : payment?.status === 'paid' ? amountDue : 0
  const method: DrugTestPaymentMethod =
    payment?.method === 'cash' || payment?.method === 'card' || payment?.method === 'pre-paid'
      ? payment.method
      : 'unknown'

  return {
    status: payment?.status || 'unpaid',
    method,
    amountDue,
    amountPaid,
    balanceDue: Math.max(0, amountDue - amountPaid),
    notes: payment?.notes || undefined,
  }
}

function paidUnknownPayment(fallbackAmountDue = 0) {
  return {
    status: 'paid' as const,
    method: 'unknown' as const,
    amountDue: fallbackAmountDue,
    amountPaid: fallbackAmountDue,
    balanceDue: 0,
    notes: undefined,
  }
}

export async function getDrugTestPaymentSnapshot(input: {
  payload: Payload
  bookingId?: string | null
  fallbackAmountDue?: number
  testType?: string | null
}) {
  const fallbackAmountDue = getFallbackAmountDue(input.testType, input.fallbackAmountDue)

  if (!input.bookingId) {
    return {
      payment: paidUnknownPayment(fallbackAmountDue),
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
    payment: normalizePayment(booking.payment, fallbackAmountDue),
  }
}
