'use server'

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

type TestTypeValue = '11-panel-lab' | '11-panel-lab-no-etg' | '17-panel-instant' | '17-panel-sos-lab' | 'etg-lab'

const FALLBACK_TEST_PRICES: Record<TestTypeValue, number> = {
  '11-panel-lab': 40,
  '11-panel-lab-no-etg': 40,
  '17-panel-instant': 35,
  '17-panel-sos-lab': 45,
  'etg-lab': 40,
}

function getFallbackAmountDue(testType?: string | null, fallbackAmountDue = 0) {
  if (typeof fallbackAmountDue === 'number' && fallbackAmountDue > 0) return fallbackAmountDue
  if (testType && testType in FALLBACK_TEST_PRICES) return FALLBACK_TEST_PRICES[testType as TestTypeValue]
  return 0
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
