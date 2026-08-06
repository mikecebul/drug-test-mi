import Stripe from 'stripe'
import type { Payload, PayloadRequest } from 'payload'

import type { Booking, Payment } from '@/payload-types'
import {
  applyAvailableClientCredit,
  applyIncomingPayment,
  getClientCreditBalance,
  normalizeMoney,
  readRelationshipId,
} from './applyPayment'
import { withPayloadTransaction } from './withPayloadTransaction'

export const DEFAULT_STRIPE_TERMINAL_LOCATION_NAME = 'The Vault'
export const DEFAULT_STRIPE_TERMINAL_READER_LABEL = 'Chx Desk'
export const GUIDED_TERMINAL_INTEGRATION = 'guided-terminal'

type TerminalPaymentState = 'pending' | 'in-progress' | 'succeeded' | 'failed' | 'cancelled'

export type GuidedTerminalPaymentStatus = {
  amount: number
  failureMessage: string | null
  id: string
  readerLabel: string
  receiptEmail: string | null
  status: TerminalPaymentState
}

function normalizeLookupValue(value: string) {
  return value.trim().toLocaleLowerCase('en-US')
}

function readTerminalStatus(payment: Payment): TerminalPaymentState {
  if (payment.status === 'posted' || payment.stripeTerminalStatus === 'succeeded') return 'succeeded'
  if (payment.status === 'voided' || payment.stripeTerminalStatus === 'failed') return 'failed'
  if (payment.stripeTerminalStatus === 'cancelled') return 'cancelled'
  if (payment.stripeTerminalStatus === 'in-progress') return 'in-progress'
  return 'pending'
}

export function serializeGuidedTerminalPayment(payment: Payment): GuidedTerminalPaymentStatus {
  return {
    amount: normalizeMoney(payment.amount),
    failureMessage: payment.stripeTerminalFailureMessage || null,
    id: String(payment.id),
    readerLabel: payment.stripeTerminalReaderLabel || DEFAULT_STRIPE_TERMINAL_READER_LABEL,
    receiptEmail: payment.receiptEmail || null,
    status: readTerminalStatus(payment),
  }
}

export function buildGuidedTerminalPaymentIntentParams(input: {
  amount: number
  bookingId: string
  clientId: string
  operationId: string
  paymentId: string
  receiptEmail: string | null
}): Stripe.PaymentIntentCreateParams {
  return {
    amount: Math.round(normalizeMoney(input.amount) * 100),
    currency: 'usd',
    capture_method: 'automatic',
    payment_method_types: ['card_present'],
    ...(input.receiptEmail ? { receipt_email: input.receiptEmail } : {}),
    metadata: {
      integration: GUIDED_TERMINAL_INTEGRATION,
      paymentId: input.paymentId,
      bookingId: input.bookingId,
      clientId: input.clientId,
      workflowOperationId: input.operationId,
    },
  }
}

export async function findGuidedTerminalReader(stripe: Stripe) {
  const configuredLocationId = process.env.STRIPE_TERMINAL_LOCATION_ID?.trim()
  const configuredReaderId = process.env.STRIPE_TERMINAL_READER_ID?.trim()
  const locationName = process.env.STRIPE_TERMINAL_LOCATION_NAME?.trim() || DEFAULT_STRIPE_TERMINAL_LOCATION_NAME
  const readerLabel = process.env.STRIPE_TERMINAL_READER_LABEL?.trim() || DEFAULT_STRIPE_TERMINAL_READER_LABEL

  const location = configuredLocationId
    ? await stripe.terminal.locations.retrieve(configuredLocationId)
    : (
        await stripe.terminal.locations.list({ limit: 100 }).autoPagingToArray({ limit: 1000 })
      ).find((candidate) => normalizeLookupValue(candidate.display_name) === normalizeLookupValue(locationName))

  if (!location || 'deleted' in location) {
    throw new Error(
      configuredLocationId
        ? 'The configured Stripe Terminal location could not be found.'
        : `Stripe Terminal location “${locationName}” could not be found.`,
    )
  }

  const reader = configuredReaderId
    ? await stripe.terminal.readers.retrieve(configuredReaderId)
    : (
        await stripe.terminal.readers.list({ location: location.id, limit: 100 }).autoPagingToArray({ limit: 1000 })
      ).find((candidate) => normalizeLookupValue(candidate.label) === normalizeLookupValue(readerLabel))

  if (!reader || 'deleted' in reader) {
    throw new Error(
      configuredReaderId
        ? 'The configured Stripe Terminal reader could not be found.'
        : `Stripe Terminal reader “${readerLabel}” could not be found at “${location.display_name}”.`,
    )
  }

  const readerLocationId = typeof reader.location === 'string' ? reader.location : reader.location?.id
  if (readerLocationId && readerLocationId !== location.id) {
    throw new Error(`Stripe Terminal reader “${reader.label}” is not assigned to “${location.display_name}”.`)
  }

  return {
    location,
    reader,
  }
}

async function findPaymentByOperation(payload: Payload, workflowOperationId: string) {
  const result = await payload.find({
    collection: 'payments',
    where: {
      and: [
        {
          workflowOperationId: {
            equals: workflowOperationId,
          },
        },
        {
          source: {
            equals: 'guided-workflow',
          },
        },
      ],
    },
    depth: 0,
    limit: 1,
    overrideAccess: true,
  })

  return (result.docs[0] as Payment | undefined) || null
}

async function markPaymentFailed(input: {
  failureMessage: string
  payload: Payload
  paymentId: string
  req?: Partial<PayloadRequest>
}) {
  return input.payload.update({
    collection: 'payments',
    id: input.paymentId,
    data: {
      status: 'voided',
      stripeTerminalStatus: 'failed',
      stripeTerminalFailureMessage: input.failureMessage,
      voidReason: input.failureMessage,
    },
    depth: 0,
    overrideAccess: true,
    req: input.req,
  })
}

export async function startGuidedTerminalPayment(input: {
  amount: number
  bookingAmountDue: number
  bookingBalanceDue: number
  bookingId: string
  clientId: string
  creditAmount: number
  operationId: string
  payload: Payload
  receiptEmail: string | null
}) {
  const existing = await findPaymentByOperation(input.payload, input.operationId)
  if (existing) {
    const status = serializeGuidedTerminalPayment(existing)
    return status.status === 'failed' || status.status === 'cancelled'
      ? { success: false as const, error: status.failureMessage || 'The Terminal payment did not complete.', payment: status }
      : { success: true as const, payment: status }
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim()
  if (!stripeSecretKey) {
    return { success: false as const, error: 'Stripe is not configured.' }
  }

  const stripe = new Stripe(stripeSecretKey, {})
  let pendingPayment: Payment | null = null
  let paymentIntent: Stripe.PaymentIntent | null = null

  try {
    const { location, reader } = await findGuidedTerminalReader(stripe)

    pendingPayment = (await input.payload.create({
      collection: 'payments',
      data: {
        relatedClient: input.clientId,
        relatedBooking: input.bookingId,
        amount: normalizeMoney(input.amount),
        method: 'stripe',
        source: 'guided-workflow',
        status: 'pending',
        reservedForBookingAmount: 0,
        appliedAmount: 0,
        creditAmount: 0,
        workflowOperationId: input.operationId,
        stripeTerminalReaderId: reader.id,
        stripeTerminalReaderLabel: reader.label,
        stripeTerminalLocationId: location.id,
        stripeTerminalLocationName: location.display_name,
        stripeTerminalStatus: 'pending',
        receiptEmail: input.receiptEmail,
        pendingCreditAmount: normalizeMoney(input.creditAmount),
        pendingBookingAmountDue: normalizeMoney(input.bookingAmountDue),
        pendingBookingBalanceDue: normalizeMoney(input.bookingBalanceDue),
      },
      depth: 0,
      overrideAccess: true,
    })) as Payment

    paymentIntent = await stripe.paymentIntents.create(
      buildGuidedTerminalPaymentIntentParams({
        amount: input.amount,
        bookingId: input.bookingId,
        clientId: input.clientId,
        operationId: input.operationId,
        paymentId: String(pendingPayment.id),
        receiptEmail: input.receiptEmail,
      }),
      {
        idempotencyKey: `guided-terminal-${input.operationId}`,
      },
    )

    await input.payload.update({
      collection: 'payments',
      id: pendingPayment.id,
      data: {
        stripePaymentIntentId: paymentIntent.id,
      },
      depth: 0,
      overrideAccess: true,
    })

    const processedReader = await stripe.terminal.readers.processPaymentIntent(reader.id, {
      payment_intent: paymentIntent.id,
    })

    if (processedReader.action?.status === 'failed') {
      const failureMessage = processedReader.action.failure_message || 'The Terminal could not process this payment.'
      const failedPayment = (await markPaymentFailed({
        failureMessage,
        payload: input.payload,
        paymentId: String(pendingPayment.id),
      })) as Payment
      return { success: false as const, error: failureMessage, payment: serializeGuidedTerminalPayment(failedPayment) }
    }

    const reconciledPayment = (await input.payload.findByID({
      collection: 'payments',
      id: pendingPayment.id,
      depth: 0,
      overrideAccess: true,
    })) as Payment
    if (reconciledPayment.status === 'posted') {
      return {
        success: true as const,
        payment: serializeGuidedTerminalPayment(reconciledPayment),
      }
    }

    const updatedPayment = (await input.payload.update({
      collection: 'payments',
      id: pendingPayment.id,
      data: {
        stripeTerminalStatus: 'in-progress',
        stripeTerminalFailureMessage: null,
      },
      depth: 0,
      overrideAccess: true,
    })) as Payment

    return {
      success: true as const,
      payment: serializeGuidedTerminalPayment(updatedPayment),
    }
  } catch (error) {
    const failureMessage = error instanceof Error ? error.message : 'Unable to start the Terminal payment.'

    if (pendingPayment) {
      await markPaymentFailed({
        failureMessage,
        payload: input.payload,
        paymentId: String(pendingPayment.id),
      }).catch(() => undefined)
    }

    if (paymentIntent && paymentIntent.status === 'requires_payment_method') {
      await stripe.paymentIntents.cancel(paymentIntent.id).catch(() => undefined)
    }

    return { success: false as const, error: failureMessage }
  }
}

export async function getGuidedTerminalPaymentStatus(input: {
  bookingId?: string
  payload: Payload
  paymentId?: string
}) {
  let payment: Payment | null = null

  if (input.paymentId) {
    payment = (await input.payload.findByID({
      collection: 'payments',
      id: input.paymentId,
      depth: 0,
      overrideAccess: true,
    })) as Payment
  } else if (input.bookingId) {
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
            source: {
              equals: 'guided-workflow',
            },
          },
          {
            stripeTerminalReaderId: {
              exists: true,
            },
          },
        ],
      },
      depth: 0,
      limit: 1,
      sort: '-createdAt',
      overrideAccess: true,
    })
    payment = (result.docs[0] as Payment | undefined) || null
  }

  return payment ? serializeGuidedTerminalPayment(payment) : null
}

export async function reconcileSucceededGuidedTerminalPayment(input: {
  paymentIntent: Stripe.PaymentIntent
  payload: Payload
}) {
  if (input.paymentIntent.metadata.integration !== GUIDED_TERMINAL_INTEGRATION) return false

  const paymentId = input.paymentIntent.metadata.paymentId
  if (!paymentId) throw new Error('Guided Terminal PaymentIntent is missing its payment ID.')

  await withPayloadTransaction(input.payload, async (req) => {
    const payment = (await input.payload.findByID({
      collection: 'payments',
      id: paymentId,
      depth: 0,
      overrideAccess: true,
      req,
    })) as Payment

    if (payment.status === 'posted') return
    if (payment.status === 'voided' || payment.status === 'refunded') {
      input.payload.logger.warn(`Ignoring succeeded Terminal PaymentIntent for ${payment.status} payment ${paymentId}`)
      return
    }
    if (payment.stripePaymentIntentId !== input.paymentIntent.id) {
      throw new Error(`Terminal PaymentIntent does not match payment ${paymentId}.`)
    }

    const clientId = readRelationshipId(payment.relatedClient)
    const bookingId = readRelationshipId(payment.relatedBooking)
    if (!clientId || !bookingId) {
      throw new Error(`Terminal payment ${paymentId} is missing its client or booking.`)
    }

    const chargedAmount = normalizeMoney(input.paymentIntent.amount_received / 100)
    if (chargedAmount !== normalizeMoney(payment.amount)) {
      throw new Error(`Terminal payment ${paymentId} amount does not match the succeeded PaymentIntent.`)
    }

    const booking = (await input.payload.findByID({
      collection: 'bookings',
      id: bookingId,
      depth: 0,
      overrideAccess: true,
      req,
    })) as Booking
    const amountDue = normalizeMoney(payment.pendingBookingAmountDue ?? booking.payment?.amountDue)
    const existingAmountPaid = Math.min(normalizeMoney(booking.payment?.amountPaid), amountDue)
    const currentBookingBalance = Math.max(0, normalizeMoney(amountDue - existingAmountPaid))
    const requestedCredit = normalizeMoney(payment.pendingCreditAmount)
    const availableCredit = await getClientCreditBalance(input.payload, clientId, req)
    const creditToApply = Math.min(requestedCredit, availableCredit)
    let creditAppliedToBooking = 0

    if (creditToApply > 0) {
      const creditPayment = await applyAvailableClientCredit({
        payload: input.payload,
        clientId,
        amount: creditToApply,
        relatedBooking: bookingId,
        bookingBalanceDue: currentBookingBalance,
        allocationOrder: 'oldest-balance-first',
        req,
      })
      creditAppliedToBooking = normalizeMoney(creditPayment?.payment.reservedForBookingAmount)
    }

    const ledgerPayment = await applyIncomingPayment({
      payload: input.payload,
      existingPaymentId: paymentId,
      clientId,
      amount: chargedAmount,
      method: 'stripe',
      source: 'guided-workflow',
      relatedBooking: bookingId,
      bookingBalanceDue: Math.max(0, normalizeMoney(currentBookingBalance - creditAppliedToBooking)),
      allocationOrder: 'oldest-balance-first',
      stripePaymentIntentId: input.paymentIntent.id,
      req,
    })

    const moneyAppliedToBooking = normalizeMoney(ledgerPayment.reservedForBookingAmount)
    const nextAmountPaid = Math.min(
      amountDue,
      normalizeMoney(existingAmountPaid + creditAppliedToBooking + moneyAppliedToBooking),
    )
    const nextBalanceDue = Math.max(0, normalizeMoney(amountDue - nextAmountPaid))

    await input.payload.update({
      collection: 'bookings',
      id: bookingId,
      data: {
        payment: {
          ...booking.payment,
          amountDue,
          amountPaid: nextAmountPaid,
          method: moneyAppliedToBooking > 0 ? 'card' : creditAppliedToBooking > 0 ? 'credit' : 'not-paid',
          status: nextBalanceDue <= 0 ? 'paid' : nextAmountPaid > 0 ? 'partial' : 'unpaid',
          collectedAt: new Date().toISOString(),
          workflowOperationId: payment.workflowOperationId,
          workflowOperationType: 'record-payment',
        },
      },
      depth: 0,
      overrideAccess: true,
      req,
    })

    await input.payload.update({
      collection: 'payments',
      id: paymentId,
      data: {
        stripeTerminalStatus: 'succeeded',
        stripeTerminalFailureMessage: null,
      },
      depth: 0,
      overrideAccess: true,
      req,
    })
  })

  return true
}

export async function markGuidedTerminalPaymentFailed(input: {
  failureMessage?: string | null
  paymentIntentId: string
  payload: Payload
}) {
  const result = await input.payload.find({
    collection: 'payments',
    where: {
      and: [
        {
          stripePaymentIntentId: {
            equals: input.paymentIntentId,
          },
        },
        {
          source: {
            equals: 'guided-workflow',
          },
        },
      ],
    },
    depth: 0,
    limit: 1,
    overrideAccess: true,
  })
  const payment = result.docs[0] as Payment | undefined
  if (!payment || payment.status !== 'pending') return false

  await markPaymentFailed({
    failureMessage: input.failureMessage || 'The card payment was declined or could not be completed.',
    payload: input.payload,
    paymentId: String(payment.id),
  })
  return true
}
