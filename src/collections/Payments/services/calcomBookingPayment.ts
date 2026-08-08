import type { Payload, PayloadRequest, Where } from 'payload'

import type { Booking, Payment } from '@/payload-types'
import { normalizeMoney, readRelationshipId } from './applyPayment'

type RequestContext = Partial<PayloadRequest>

type StripeSessionBookingInput = {
  metadata?: Record<string, string> | null
  clientReferenceId?: string | null
  stripeCheckoutSessionId?: string | null
  stripePaymentIntentId?: string | null
  req?: RequestContext
}

type SyncCalcomPrepaidBookingPaymentInput = {
  payload: Payload
  booking: Booking
  amount?: number | null
  stripeCheckoutSessionId?: string | null
  stripePaymentIntentId?: string | null
  collectedAt?: string | null
  req?: RequestContext
}

type BookingPaymentClientInput = {
  payload: Payload
  bookingId: string
  clientId: string
  req?: RequestContext
}

function getString(value: unknown) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed || null
}

function getStringFromMetadata(metadata: Record<string, string> | null | undefined, keys: string[]) {
  if (!metadata) return null

  for (const key of keys) {
    const value = getString(metadata[key])
    if (value) return value
  }

  return null
}

function getNumberFromMetadata(metadata: Record<string, string> | null | undefined, keys: string[]) {
  const value = getStringFromMetadata(metadata, keys)
  if (!value) return null

  const parsed = Number(value)
  return Number.isInteger(parsed) ? parsed : null
}

function getBookingId(booking: Booking) {
  return String(booking.id)
}

function getBookingAmount(booking: Booking, fallbackAmount?: number | null) {
  const fallback = normalizeMoney(fallbackAmount)
  if (fallback > 0) return fallback

  const amountPaid = normalizeMoney(booking.payment?.amountPaid)
  if (amountPaid > 0) return amountPaid

  return normalizeMoney(booking.payment?.amountDue)
}

function getBookingReservedAmount(booking: Booking, amount: number) {
  const amountDue = normalizeMoney(booking.payment?.amountDue)
  return Math.min(amount, amountDue > 0 ? amountDue : amount)
}

function getStripePaymentIntentId(booking: Booking, paymentIntentId?: string | null) {
  const inputPaymentIntentId = getString(paymentIntentId)
  if (inputPaymentIntentId) return inputPaymentIntentId

  const calcomPaymentId = getString(booking.calcomPaymentId)
  return calcomPaymentId?.startsWith('pi_') ? calcomPaymentId : null
}

function getStripeCheckoutSessionId(booking: Booking, checkoutSessionId?: string | null) {
  const inputCheckoutSessionId = getString(checkoutSessionId)
  if (inputCheckoutSessionId) return inputCheckoutSessionId

  const calcomPaymentId = getString(booking.calcomPaymentId)
  return calcomPaymentId?.startsWith('cs_') ? calcomPaymentId : null
}

function isPaidCalcomBooking(booking: Booking, amount: number) {
  if (amount <= 0) return false
  const payment = booking.payment
  if (!payment) return false

  return payment.method === 'pre-paid' && payment.status === 'paid'
}

async function findPaymentByIdentifiers(input: {
  payload: Payload
  bookingId: string
  stripeCheckoutSessionId?: string | null
  stripePaymentIntentId?: string | null
  req?: RequestContext
}) {
  const or: Where[] = [
    {
      and: [
        {
          relatedBooking: {
            equals: input.bookingId,
          },
        },
        {
          source: {
            in: ['calcom', 'stripe-checkout'],
          },
        },
      ],
    },
  ]

  if (input.stripeCheckoutSessionId) {
    or.unshift({
      stripeCheckoutSessionId: {
        equals: input.stripeCheckoutSessionId,
      },
    })
  }

  if (input.stripePaymentIntentId) {
    or.unshift({
      stripePaymentIntentId: {
        equals: input.stripePaymentIntentId,
      },
    })
  }

  const result = await input.payload.find({
    collection: 'payments',
    where: {
      or,
    },
    depth: 0,
    limit: 1,
    sort: '-createdAt',
    overrideAccess: true,
    req: input.req,
  })

  return (result.docs[0] as Payment | undefined) || null
}

export async function findRefundableCalcomBookingPayment(input: {
  payload: Payload
  bookingId: string
  req?: RequestContext
}) {
  const result = await input.payload.find({
    collection: 'payments',
    where: {
      and: [
        {
          relatedBooking: {
            equals: input.bookingId,
          },
        },
        {
          status: {
            equals: 'posted',
          },
        },
        {
          method: {
            equals: 'stripe',
          },
        },
        {
          source: {
            in: ['calcom', 'stripe-checkout'],
          },
        },
      ],
    },
    depth: 0,
    limit: 5,
    sort: '-collectedAt',
    overrideAccess: true,
    req: input.req,
  })

  return (result.docs as Payment[]).find((payment) => normalizeMoney(payment.amount) > 0) || null
}

export async function syncCalcomPrepaidBookingPayment(input: SyncCalcomPrepaidBookingPaymentInput) {
  const amount = getBookingAmount(input.booking, input.amount)
  if (!isPaidCalcomBooking(input.booking, amount)) return null

  const bookingId = getBookingId(input.booking)
  const clientId = readRelationshipId(input.booking.relatedClient)
  const stripeCheckoutSessionId = getStripeCheckoutSessionId(input.booking, input.stripeCheckoutSessionId)
  const stripePaymentIntentId = getStripePaymentIntentId(input.booking, input.stripePaymentIntentId)
  const existingPayment = await findPaymentByIdentifiers({
    payload: input.payload,
    bookingId,
    stripeCheckoutSessionId,
    stripePaymentIntentId,
    req: input.req,
  })

  if (existingPayment?.status === 'voided' || existingPayment?.status === 'refunded') {
    return existingPayment
  }

  // Once a Stripe refund has been recorded, the ledger keeps the original gross
  // payment amount and tracks refunds separately. Do not replace the gross amount
  // with the booking's net amount on a later synchronization pass.
  if (existingPayment && normalizeMoney(existingPayment.refundedAmount) > 0) {
    return existingPayment
  }

  const data = {
    ...(clientId ? { relatedClient: clientId } : {}),
    relatedBooking: bookingId,
    amount,
    method: 'stripe' as const,
    source: 'calcom' as const,
    status: 'posted' as const,
    collectedAt: input.booking.payment?.collectedAt || input.collectedAt || new Date().toISOString(),
    reservedForBookingAmount: getBookingReservedAmount(input.booking, amount),
    appliedAmount: 0,
    creditAmount: 0,
    allocations: [],
    ...(stripeCheckoutSessionId ? { stripeCheckoutSessionId } : {}),
    ...(stripePaymentIntentId ? { stripePaymentIntentId } : {}),
  }

  if (existingPayment) {
    return input.payload.update({
      collection: 'payments',
      id: existingPayment.id,
      data,
      depth: 0,
      overrideAccess: true,
      req: input.req,
    })
  }

  return input.payload.create({
    collection: 'payments',
    data,
    depth: 0,
    overrideAccess: true,
    req: input.req,
  })
}

export async function syncBookingPaymentClient(input: BookingPaymentClientInput) {
  const result = await input.payload.find({
    collection: 'payments',
    where: {
      relatedBooking: {
        equals: input.bookingId,
      },
    },
    depth: 0,
    limit: 100,
    overrideAccess: true,
    req: input.req,
  })

  const updates = (result.docs as Payment[])
    .filter((payment) => !readRelationshipId(payment.relatedClient))
    .map((payment) =>
      input.payload.update({
        collection: 'payments',
        id: payment.id,
        data: {
          relatedClient: input.clientId,
        },
        depth: 0,
        overrideAccess: true,
        req: input.req,
      }),
    )

  await Promise.all(updates)
}

export async function findCalcomBookingForStripeSession(payload: Payload, input: StripeSessionBookingInput) {
  const uid =
    getStringFromMetadata(input.metadata, [
      'calcomBookingId',
      'calcomBookingUid',
      'calcomUid',
      'bookingUid',
      'bookingUID',
      'booking_uid',
      'cal_booking_uid',
      'uid',
    ]) || getString(input.clientReferenceId)

  if (uid) {
    const byUid = await payload.find({
      collection: 'bookings',
      where: {
        calcomBookingId: {
          equals: uid,
        },
      },
      depth: 0,
      limit: 1,
      overrideAccess: true,
      req: input.req,
    })

    if (byUid.docs[0]) return byUid.docs[0] as Booking
  }

  const numericId = getNumberFromMetadata(input.metadata, ['calcomBookingNumericId', 'bookingId', 'booking_id'])
  if (numericId) {
    const byNumericId = await payload.find({
      collection: 'bookings',
      where: {
        calcomBookingNumericId: {
          equals: numericId,
        },
      },
      depth: 0,
      limit: 1,
      overrideAccess: true,
      req: input.req,
    })

    if (byNumericId.docs[0]) return byNumericId.docs[0] as Booking
  }

  const paymentId = getString(input.stripePaymentIntentId) || getString(input.stripeCheckoutSessionId)
  if (!paymentId) return null

  const byPaymentId = await payload.find({
    collection: 'bookings',
    where: {
      calcomPaymentId: {
        equals: paymentId,
      },
    },
    depth: 0,
    limit: 1,
    overrideAccess: true,
    req: input.req,
  })

  return (byPaymentId.docs[0] as Booking | undefined) || null
}

export async function recordCalcomStripeCheckoutPayment(input: {
  payload: Payload
  booking: Booking
  amount: number
  stripeCheckoutSessionId: string
  stripePaymentIntentId?: string | null
  collectedAt?: string | null
  req?: RequestContext
}) {
  const amount = normalizeMoney(input.amount)
  if (amount <= 0) return null

  const existingPayment = input.booking.payment || {}
  const alreadyPaid =
    existingPayment.method === 'pre-paid' &&
    existingPayment.status === 'paid' &&
    normalizeMoney(existingPayment.amountPaid) >= amount

  const booking = alreadyPaid
    ? input.booking
    : ((await input.payload.update({
        collection: 'bookings',
        id: input.booking.id,
        data: {
          calcomPaymentId: input.stripePaymentIntentId || input.stripeCheckoutSessionId,
          payment: {
            ...existingPayment,
            amountDue: amount,
            amountPaid: amount,
            method: 'pre-paid',
            status: 'paid',
            collectedAt: input.collectedAt || new Date().toISOString(),
          },
        },
        depth: 0,
        overrideAccess: true,
        req: input.req,
      })) as Booking)

  return syncCalcomPrepaidBookingPayment({
    payload: input.payload,
    booking,
    amount,
    stripeCheckoutSessionId: input.stripeCheckoutSessionId,
    stripePaymentIntentId: input.stripePaymentIntentId,
    collectedAt: input.collectedAt,
    req: input.req,
  })
}
