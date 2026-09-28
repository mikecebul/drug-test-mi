import { beforeEach, expect, it, vi } from 'vitest'
import type { Payload } from 'payload'
import type Stripe from 'stripe'
import { checkoutSessionCompleted } from './checkoutSessionCompleted'
import { checkoutSessionAsyncPaymentFailed } from './checkoutSessionAsyncPaymentFailed'
import { applyIncomingPayment } from '@/collections/Payments/services/applyPayment'

vi.mock('@/collections/Payments/services/withPayloadTransaction', () => ({
  withPayloadTransaction: async (_payload: Payload, operation: (req: object) => Promise<unknown>) => operation({}),
}))
vi.mock('@/collections/Payments/services/applyPayment', () => ({
  applyIncomingPayment: vi.fn(),
  readRelationshipId: (value: unknown) => (typeof value === 'string' ? value : null),
}))
vi.mock('@/collections/Payments/services/calcomBookingPayment', () => ({
  findCalcomBookingForStripeSession: vi.fn(),
  recordCalcomStripeCheckoutPayment: vi.fn(),
}))

beforeEach(() => vi.clearAllMocks())

function checkoutSession(paymentStatus: Stripe.Checkout.Session.PaymentStatus) {
  return {
    id: 'cs_bank',
    metadata: { paymentId: 'payment-1' },
    payment_status: paymentStatus,
    amount_total: 4000,
    payment_intent: 'pi_bank',
  } as unknown as Stripe.Checkout.Session
}

it('keeps an ACH checkout pending until Stripe reports that the delayed payment succeeded', async () => {
  const payment = {
    id: 'payment-1',
    status: 'pending',
    amount: 40,
    relatedClient: 'client-1',
    relatedDrugTest: 'test-1',
    stripeCheckoutSessionId: 'cs_bank',
  }
  const payload = {
    findByID: vi.fn().mockResolvedValue(payment),
    logger: { info: vi.fn() },
  } as unknown as Payload

  await checkoutSessionCompleted({ event: { data: { object: checkoutSession('unpaid') } }, payload } as Parameters<
    typeof checkoutSessionCompleted
  >[0])
  expect(applyIncomingPayment).not.toHaveBeenCalled()

  await checkoutSessionCompleted({ event: { data: { object: checkoutSession('paid') } }, payload } as Parameters<
    typeof checkoutSessionCompleted
  >[0])
  expect(applyIncomingPayment).toHaveBeenCalledOnce()
  expect(applyIncomingPayment).toHaveBeenCalledWith(
    expect.objectContaining({
      existingPaymentId: 'payment-1',
      clientId: 'client-1',
      amount: 40,
      stripeCheckoutSessionId: 'cs_bank',
      stripePaymentIntentId: 'pi_bank',
    }),
  )
})

it('voids a pending client checkout when Stripe reports delayed payment failure', async () => {
  const payload = {
    findByID: vi.fn().mockResolvedValue({
      id: 'payment-1',
      status: 'pending',
      stripeCheckoutSessionId: 'cs_bank',
    }),
    update: vi.fn(),
  } as unknown as Payload

  await checkoutSessionAsyncPaymentFailed({
    event: { data: { object: checkoutSession('unpaid') } },
    payload,
  } as Parameters<typeof checkoutSessionAsyncPaymentFailed>[0])
  expect(payload.update).toHaveBeenCalledWith(
    expect.objectContaining({
      collection: 'payments',
      id: 'payment-1',
      data: expect.objectContaining({ status: 'voided' }),
    }),
  )
})

it('does not void a payment belonging to another Checkout session', async () => {
  const payload = {
    findByID: vi.fn().mockResolvedValue({
      id: 'payment-1',
      status: 'pending',
      stripeCheckoutSessionId: 'cs_other',
    }),
    update: vi.fn(),
  } as unknown as Payload

  await checkoutSessionAsyncPaymentFailed({
    event: { data: { object: checkoutSession('unpaid') } },
    payload,
  } as Parameters<typeof checkoutSessionAsyncPaymentFailed>[0])
  expect(payload.update).not.toHaveBeenCalled()
})
