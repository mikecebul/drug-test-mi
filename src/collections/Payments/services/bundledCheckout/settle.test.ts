import type { Payload } from 'payload'
import type Stripe from 'stripe'
import { describe, expect, it, vi } from 'vitest'
import { settleBundledCheckout } from './settle'

const syncClientMoneyOwed = vi.hoisted(() => vi.fn())
vi.mock('@/collections/DrugTests/hooks/syncClientBalance', () => ({ syncClientMoneyOwed }))
vi.mock('../withPayloadTransaction', () => ({
  withPayloadTransaction: async (_payload: unknown, operation: (req: unknown) => Promise<unknown>) =>
    operation({ transactionID: 'transaction' }),
}))

function setup() {
  const selected = [
    { drugTest: 'confirmation-1', kind: 'new-confirmation', amountCents: 4500 },
    { drugTest: 'confirmation-2', kind: 'new-confirmation', amountCents: 4500 },
    { drugTest: 'screen-1', kind: 'screen', amountCents: 4000 },
    { drugTest: 'screen-2', kind: 'screen', amountCents: 4000 },
  ]
  const tests = [
    ...selected.map((charge) => ({
      id: charge.drugTest,
      payment: { amountDue: 40, amountPaid: charge.kind === 'screen' ? 0 : 40, confirmationFeeDue: 0 },
    })),
    { id: 'excluded-confirmation', payment: { amountDue: 85, amountPaid: 40, confirmationFeeDue: 45 } },
  ]
  const payment = {
    id: 'payment',
    status: 'pending',
    amount: 170,
    relatedClient: 'client',
    stripeCheckoutSessionId: 'session',
    bundledCheckout: { requestId: 'bundle', charges: selected },
  }
  const session = {
    id: 'session',
    mode: 'payment',
    status: 'complete',
    payment_status: 'paid',
    currency: 'usd',
    amount_total: 17000,
    payment_intent: 'pi_test_1',
    metadata: { clientId: 'client', bundledPaymentId: 'payment' },
  } as unknown as Stripe.Checkout.Session

  const payload = {
    findByID: vi.fn(async ({ collection }) => collection === 'payments' ? payment : { referral: null }),
    find: vi.fn(async () => ({ docs: tests })),
    update: vi.fn(async ({ collection, data }: { collection: string; id: string; data: Record<string, unknown> }) => {
      if (collection === 'payments') payment.status = String(data.status)
    }),
    create: vi.fn(),
  }

  return { payload, settle: (stripeSession = session) => settleBundledCheckout(payload as unknown as Payload, stripeSession, 100), session, tests }
}

describe('bundled Stripe checkout settlement', () => {
  it('records new fees and posts only the four selected charges once', async () => {
    const { payload, settle } = setup()
    await settle()
    await settle()

    const changes = payload.update.mock.calls.map(([args]) => args).filter((args) => args.collection === 'drug-tests')
    expect(changes.map(({ id }) => id)).toEqual(['confirmation-1', 'confirmation-2', 'screen-1', 'screen-2'])
    expect(changes[0].data.payment).toMatchObject({
      amountDue: 85, confirmationFeeDue: 45, amountPaid: 85, balanceDue: 0, status: 'paid',
    })
    expect(changes[3].data.payment).toMatchObject({ amountDue: 40, amountPaid: 40, balanceDue: 0, status: 'paid' })
    expect(payload.update).toHaveBeenCalledWith(expect.objectContaining({
      collection: 'payments',
      data: expect.objectContaining({ status: 'posted', appliedAmount: 170, bundledCheckout: { unappliedAmount: 0 } }),
    }))
    expect(syncClientMoneyOwed).toHaveBeenCalledWith(expect.objectContaining({ transactionID: 'transaction' }), 'client')
  })

  it('leaves a balance paid through another channel unapplied and alerts an admin', async () => {
    const { payload, settle, tests } = setup()
    tests[3].payment.amountPaid = 40
    await settle()

    expect(payload.update).toHaveBeenCalledWith(expect.objectContaining({
      collection: 'payments',
      data: expect.objectContaining({ appliedAmount: 130, bundledCheckout: { unappliedAmount: 40 } }),
    }))
    expect(payload.create).toHaveBeenCalledWith(expect.objectContaining({ collection: 'admin-alerts' }))
    expect(payload.update.mock.calls.map(([args]) => args.id)).not.toContain('screen-2')
  })

  it('rejects mismatched Stripe totals and waits for paid status', async () => {
    const { payload, settle, session } = setup()
    await expect(settle({ ...session, amount_total: 16999 })).rejects.toThrow(/does not match/)
    await settle({ ...session, payment_status: 'unpaid' })
    expect(payload.update).not.toHaveBeenCalled()
  })
})
