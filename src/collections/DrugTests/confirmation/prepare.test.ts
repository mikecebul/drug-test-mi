import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { Payload } from 'payload'
const credit = vi.hoisted(() => vi.fn())
vi.mock('@/collections/Payments/services/withPayloadTransaction', () => ({
  withPayloadTransaction: async (_payload: unknown, fn: (req: unknown) => unknown) => fn({ transactionID: 'txn' }),
}))
vi.mock('@/collections/Payments/services/applyPayment', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  applyAvailableClientCredit: credit,
}))
import { prepareConfirmation } from './prepare'
const user = {
  id: 'owner',
  collection: 'admins',
  role: 'superAdmin',
  email: 'owner@example.com',
  createdAt: '2025-01-01',
  updatedAt: '2025-01-01',
} as const
const resultDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
function setup(overrides: Record<string, unknown> = {}) {
  let testRecord = {
    id: 'test',
    testType: '11-panel-lab',
    relatedClient: 'client',
    screeningStatus: 'collected',
    payment: { amountDue: 35, amountPaid: 35, balanceDue: 0 },
    billingResponsibility: { payer: 'client' },
    ...overrides,
  }
  const payload = {
    findByID: vi.fn(async () => testRecord),
    find: vi.fn(async () => ({ docs: [] })),
    update: vi.fn(async ({ data }: { data: typeof testRecord }) => {
      testRecord = { ...testRecord, ...data }
      return testRecord
    }),
  }
  return {
    payload,
    input: {
      payload: payload as unknown as Payload,
      user,
      testId: 'test',
      decision: 'request-confirmation' as const,
      substances: ['amphetamines', 'amphetamines'],
      screenedAt: resultDate,
    },
  }
}
beforeEach(() => credit.mockClear())
describe('prepare confirmation decision', () => {
  test('deduplicates fees and preserves the first date/request across Back and Next', async () => {
    const { payload, input } = setup()
    const first = await prepareConfirmation(input)
    await prepareConfirmation({ ...input, screenedAt: new Date().toISOString() })
    expect(payload.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          screenedAt: resultDate,
          confirmationRequestKey: first.confirmationRequestKey,
          payment: expect.objectContaining({ amountDue: 80, confirmationFeeDue: 45 }),
        }),
      }),
    )
    expect(credit).toHaveBeenCalledWith(
      expect.objectContaining({
        relatedDrugTest: 'test',
        purpose: 'confirmation',
        confirmationRequestKey: first.confirmationRequestKey,
      }),
    )
  })
  test('keeps referral payer/invoice and does not consume client credit', async () => {
    const { payload, input } = setup({
      billingResponsibility: { payer: 'referral', referral: { relationTo: 'courts', value: 'court' } },
      payment: { status: 'invoiced', amountDue: 35, amountPaid: 0, referralInvoice: 'invoice' },
    })
    await prepareConfirmation(input)
    expect(credit).not.toHaveBeenCalled()
    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          payment: expect.objectContaining({ status: 'invoiced', referralInvoice: 'invoice', amountDue: 80 }),
        }),
      }),
    )
  })
  test('blocks new requests after the hold without changing the stored result', async () => {
    const { payload, input } = setup({ screenedAt: '2025-01-01T00:00:00Z' })
    await expect(prepareConfirmation(input)).rejects.toThrow()
    expect(payload.update).not.toHaveBeenCalled()
  })
  test('does not silently remove a paid confirmation when the decision changes', async () => {
    const { payload, input } = setup({
      confirmationDecision: 'request-confirmation',
      confirmationSubstances: ['amphetamines'],
      confirmationRequestKey: 'request',
      payment: { amountDue: 80, amountPaid: 80, confirmationFeeDue: 45, confirmationFeePaid: 45 },
    })
    await expect(prepareConfirmation({ ...input, decision: 'accept', substances: [] })).rejects.toThrow()
    expect(payload.update).not.toHaveBeenCalled()
  })
  test('admins can request but cannot bypass payment, and clients cannot request', async () => {
    const { input } = setup()
    await expect(
      prepareConfirmation({ ...input, user: { ...user, role: 'admin' }, bypassPaymentRequirement: true }),
    ).rejects.toThrow()
    await expect(prepareConfirmation({ ...input, user: { ...user, collection: 'clients' } as never })).rejects.toThrow()
  })
})
