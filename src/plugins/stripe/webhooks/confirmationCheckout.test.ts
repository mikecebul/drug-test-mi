import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { Payload } from 'payload'
import { checkoutSessionCompleted } from './checkoutSessionCompleted'
import { applyIncomingPayment } from '@/collections/Payments/services/applyPayment'
vi.mock('@/collections/Payments/services/withPayloadTransaction', () => ({
  withPayloadTransaction: async (_: unknown, fn: (req: object) => unknown) => fn({ transactionID: 'txn' }),
}))
vi.mock('@/collections/Payments/services/applyPayment', () => ({
  applyIncomingPayment: vi.fn(),
  readRelationshipId: (value: unknown) => (typeof value === 'string' ? value : null),
}))
const pending = {
  id: 'pay',
  status: 'pending',
  relatedClient: 'client',
  relatedDrugTest: 'test',
  amount: 45,
  purpose: 'confirmation',
  confirmationRequestKey: 'request',
  stripeCheckoutSessionId: 'cs',
}
function invoke(overrides: object = {}, stored = pending) {
  const payload = { findByID: vi.fn().mockResolvedValue(stored), logger: { info: vi.fn() } } as unknown as Payload
  return checkoutSessionCompleted({
    payload,
    event: {
      data: {
        object: {
          id: 'cs',
          payment_status: 'paid',
          currency: 'usd',
          amount_total: 4500,
          metadata: { paymentId: 'pay', drugTestId: 'test', clientId: 'client', confirmationRequestKey: 'request' },
          ...overrides,
        },
      },
    },
  } as never)
}
beforeEach(() => vi.clearAllMocks())
describe('confirmation Stripe fulfillment', () => {
  test('only a verified paid session posts to its specific test/request', async () => {
    await invoke({ payment_status: 'unpaid' })
    expect(applyIncomingPayment).not.toHaveBeenCalled()
    await invoke()
    expect(applyIncomingPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        purpose: 'confirmation',
        confirmationRequestKey: 'request',
        amount: 45,
        relatedDrugTest: 'test',
      }),
    )
  })
  test.each([
    { id: 'different-cs' },
    { currency: 'eur' },
    { amount_total: 1 },
    { metadata: { paymentId: 'pay', confirmationRequestKey: 'different' } },
  ])('rejects a session not bound to the stored payment: %j', async (override) => {
    await expect(invoke(override)).rejects.toThrow('does not match')
    expect(applyIncomingPayment).not.toHaveBeenCalled()
  })
  test('real money from a voided confirmation link cannot authorize the lab request', async () => {
    await invoke({}, { ...pending, status: 'voided' })
    expect(applyIncomingPayment).toHaveBeenCalledWith(expect.objectContaining({ confirmationAllocationDisabled: true }))
  })
  test('duplicate deliveries do not repost a completed ledger entry', async () => {
    await invoke({}, { ...pending, status: 'posted' })
    expect(applyIncomingPayment).not.toHaveBeenCalled()
  })
})
