import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { Payload } from 'payload'
import type Stripe from 'stripe'
vi.mock('@/collections/Payments/services/withPayloadTransaction', () => ({
  withPayloadTransaction: async (_: unknown, fn: (req: unknown) => unknown) => fn({ transactionID: 'txn' }),
}))
import { sendConfirmationPaymentLink } from './paymentLink'
function setup() {
  const testRecord = {
    id: 'test',
    relatedClient: 'client',
    confirmationRequestKey: 'request',
    confirmationDecision: 'request-confirmation',
    confirmationHoldUntil: new Date(Date.now() + 10 * 86400000).toISOString(),
    billingResponsibility: { payer: 'client' },
    payment: { amountDue: 80, amountPaid: 0, confirmationFeeDue: 45, confirmationFeePaid: 0 },
  }
  let payment: Record<string, unknown> | undefined
  const payload = {
    findByID: vi.fn(async ({ collection }: { collection: string }) =>
      collection === 'drug-tests' ? testRecord : { id: 'client', email: 'client@example.com', firstName: '<Alex>' },
    ),
    find: vi.fn(async () => ({ docs: payment ? [payment] : [] })),
    create: vi.fn(async ({ data }: { data: object }) => {
      payment = { id: 'pay', ...data }
      return payment
    }),
    update: vi.fn(async ({ collection, data }: { collection: string; data: object }) => {
      if (collection === 'payments') payment = { ...payment, ...data }
      return collection === 'payments' ? payment : { ...testRecord, ...data }
    }),
    db: {
      findOne: vi.fn(async () => ({ ...testRecord, updatedAt: new Date().toISOString() })),
      updateOne: vi.fn(async ({ collection, data }: { collection: string; data: Record<string, unknown> }) => {
        if (collection === 'drug-tests') return testRecord
        if (payment && data.paymentLinkEmailSendingAt === null) {
          payment = { ...payment, ...data }
          return payment
        }
        if (!payment || payment.paymentLinkEmailSentAt || payment.paymentLinkEmailSendingAt) return null
        payment = { ...payment, ...data }
        return payment
      }),
    },
    sendEmail: vi.fn().mockResolvedValue(undefined),
  }
  const session = { id: 'cs', url: 'https://checkout.stripe.com/example', status: 'open' }
  const stripe = {
    checkout: {
      sessions: {
        create: vi.fn().mockResolvedValue(session),
        retrieve: vi.fn().mockResolvedValue(session),
        expire: vi.fn(),
      },
    },
  }
  return {
    payload,
    stripe,
    testRecord,
    run: () => sendConfirmationPaymentLink(payload as unknown as Payload, 'test', stripe as unknown as Stripe),
  }
}
beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_IS_LIVE', 'true')
  vi.stubEnv('EMAIL_TEST_MODE', 'false')
})
describe('confirmation payment emails', () => {
  test('a failed email can retry the same checkout without creating another payment', async () => {
    const { payload, stripe, run } = setup()
    payload.sendEmail.mockRejectedValueOnce(new Error('SMTP unavailable'))
    await expect(run()).rejects.toThrow('SMTP unavailable')
    expect(await run()).toMatchObject({ sent: true })
    expect(payload.create).toHaveBeenCalledTimes(1)
    expect(stripe.checkout.sessions.create).toHaveBeenCalledTimes(1)
  })
  test('emails only the selected fee once, uses a stable Stripe idempotency key, and returns immediately', async () => {
    const { payload, stripe, run } = setup()
    expect(await run()).toMatchObject({ sent: true })
    expect(await run()).toMatchObject({ sent: false })
    expect(stripe.checkout.sessions.create).toHaveBeenCalledTimes(1)
    expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        line_items: [expect.objectContaining({ price_data: expect.objectContaining({ unit_amount: 4500 }) })],
        metadata: expect.objectContaining({ purpose: 'confirmation', confirmationRequestKey: 'request' }),
      }),
      { idempotencyKey: 'confirmation-checkout-pay' },
    )
    expect(payload.sendEmail).toHaveBeenCalledTimes(1)
    const email = payload.sendEmail.mock.calls[0][0] as { html: string; to: string[] }
    expect(email.to).toEqual(['client@example.com'])
    expect(email.html).toContain('&lt;Alex&gt;')
    expect(email.html).not.toContain('$80.00')
  })
  test('referral billing cannot send a client link or create Stripe checkout', async () => {
    const { run, stripe, testRecord } = setup()
    testRecord.billingResponsibility.payer = 'referral'
    await expect(run()).rejects.toThrow()
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled()
  })
  test('email failure leaves a reusable link for retry and does not duplicate the payment', async () => {
    const { run, payload, stripe } = setup()
    payload.sendEmail.mockRejectedValueOnce(new Error('SMTP unavailable'))
    await expect(run()).rejects.toThrow()
    await run()
    expect(payload.create).toHaveBeenCalledTimes(1)
    expect(stripe.checkout.sessions.create).toHaveBeenCalledTimes(1)
  })
})
