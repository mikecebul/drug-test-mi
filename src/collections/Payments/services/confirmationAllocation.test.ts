import { describe, expect, test, vi } from 'vitest'
import type { Payload } from 'payload'
import { applyIncomingPayment, applyAvailableClientCredit } from './applyPayment'
import { reversePostedPayments } from './reversePayments'
function setup(credit = 0) {
  const testRecord = {
    id: 'test',
    relatedClient: 'client',
    confirmationDecision: 'request-confirmation',
    confirmationRequestKey: 'request',
    confirmationHoldUntil: new Date(Date.now() + 86400000).toISOString(),
    billingResponsibility: { payer: 'client' },
    payment: { amountDue: 80, amountPaid: 0, balanceDue: 80, confirmationFeeDue: 45, confirmationFeePaid: 0 },
  }
  const client = { id: 'client', creditBalance: credit }
  const payload = {
    findByID: vi.fn(async ({ collection }: { collection: string }) => (collection === 'clients' ? client : testRecord)),
    find: vi.fn(async () => ({
      docs: [
        {
          id: 'older',
          payment: { amountDue: 100, amountPaid: 0, balanceDue: 100 },
          billingResponsibility: { payer: 'client' },
        },
      ],
    })),
    update: vi.fn(async ({ collection, data }: { collection: string; data: object }) => {
      const target = collection === 'clients' ? client : testRecord
      Object.assign(target, data)
      return structuredClone(target)
    }),
    create: vi.fn(async ({ data }: { data: object }) => ({ id: 'payment', ...data })),
  }
  return {
    payload,
    testRecord,
    client,
    input: {
      payload: payload as unknown as Payload,
      clientId: 'client',
      relatedDrugTest: 'test',
      purpose: 'confirmation' as const,
      confirmationRequestKey: 'request',
    },
  }
}
describe('confirmation ledger allocation', () => {
  test('Stripe money targets the selected fee rather than older debt; partial and full payments retain base balance', async () => {
    const { payload, testRecord, input } = setup()
    await applyIncomingPayment({ ...input, amount: 20, source: 'stripe-checkout', method: 'stripe' })
    expect(testRecord.payment).toMatchObject({ confirmationFeePaid: 20, balanceDue: 60 })
    await applyIncomingPayment({ ...input, amount: 25, source: 'stripe-checkout', method: 'stripe' })
    expect(testRecord.payment).toMatchObject({ confirmationFeePaid: 45, balanceDue: 35 })
    expect(payload.find).not.toHaveBeenCalled()
    expect(payload.create).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ allocations: [{ drugTest: 'test', amount: 25, confirmationAmount: 25 }] }),
      }),
    )
  })
  test('account credit funds the selected confirmation and leaves unused credit untouched', async () => {
    const { input, client, testRecord } = setup(100)
    await applyAvailableClientCredit(input)
    expect(testRecord.payment.confirmationFeePaid).toBe(45)
    expect(client.creditBalance).toBe(55)
  })
  test('stale/expired Stripe money becomes account credit plus a durable review alert', async () => {
    const { input, client, payload, testRecord } = setup()
    testRecord.confirmationHoldUntil = '2025-01-01T00:00:00Z'
    await applyIncomingPayment({ ...input, amount: 45, source: 'stripe-checkout', method: 'stripe' })
    expect(testRecord.payment.confirmationFeePaid).toBe(0)
    expect(client.creditBalance).toBe(45)
    expect(payload.create).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'admin-alerts', data: expect.objectContaining({ severity: 'high' }) }),
    )
  })
  test('undoing a fee payment removes its authorization and records the reversal', async () => {
    const { input, testRecord, payload } = setup()
    await applyIncomingPayment({ ...input, amount: 45, source: 'stripe-checkout', method: 'stripe' })
    await reversePostedPayments({
      payload: payload as unknown as Payload,
      clientId: 'client',
      reason: 'undo',
      payments: [
        {
          id: 'payment',
          status: 'posted',
          method: 'stripe',
          source: 'stripe-checkout',
          amount: 45,
          creditAmount: 0,
          allocations: [{ drugTest: 'test', amount: 45, confirmationAmount: 45 }],
        },
      ],
    })
    expect(testRecord.payment).toMatchObject({ confirmationFeePaid: 0, amountPaid: 0, balanceDue: 80 })
  })
})

test('undoing a base-only payment leaves a separately funded confirmation fee available', async () => {
  const { input, testRecord, payload } = setup()
  await applyIncomingPayment({ ...input, amount: 45, source: 'stripe-checkout', method: 'stripe' })
  testRecord.payment.amountPaid = 80
  testRecord.payment.balanceDue = 0
  await reversePostedPayments({
    payload: payload as unknown as Payload,
    clientId: 'client',
    reason: 'base refund',
    payments: [
      {
        id: 'base-payment',
        status: 'posted',
        method: 'cash',
        source: 'manual',
        amount: 35,
        creditAmount: 0,
        allocations: [{ drugTest: 'test', amount: 35, confirmationAmount: 0 }],
      },
    ],
  })
  expect(testRecord.payment).toMatchObject({ confirmationFeePaid: 45, amountPaid: 45, balanceDue: 35 })
})
