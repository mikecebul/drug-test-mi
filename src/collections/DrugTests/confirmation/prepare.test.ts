import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { Payload } from 'payload'
const credit = vi.hoisted(() => vi.fn())
const balance = vi.hoisted(() => vi.fn())
const closeLinks = vi.hoisted(() => vi.fn())
vi.mock('@/collections/Payments/services/closePendingClientCheckoutSessions', () => ({
  closePendingClientCheckoutSessions: closeLinks,
}))
vi.mock('@/collections/Payments/services/withPayloadTransaction', () => ({
  withPayloadTransaction: async (_payload: unknown, fn: (req: unknown) => unknown) => fn({ transactionID: 'txn' }),
}))
vi.mock('@/collections/Payments/services/applyPayment', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  applyAvailableClientCredit: credit,
  getClientCreditBalance: balance,
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
beforeEach(() => {
  credit.mockClear()
  closeLinks.mockClear()
  balance.mockResolvedValue(90)
})
describe('prepare confirmation decision', () => {
  test('explicit credit preserves the prior admin exception and its original author/time', async () => {
    const { input } = setup({
      confirmationDecision: 'request-confirmation',
      confirmationSubstances: ['amphetamines'],
      confirmationRequestKey: 'request',
      confirmationNotificationAdmin: 'owner',
      payment: {
        amountDue: 80,
        amountPaid: 35,
        confirmationFeeDue: 45,
        confirmationFeePaid: 0,
        confirmationPaymentBypassed: true,
        confirmationPaymentBypassedBy: 'prior-admin',
        confirmationPaymentBypassedAt: resultDate,
      },
    })
    credit.mockResolvedValueOnce({ usedCredit: 45 })
    const prepared = await prepareConfirmation({
      ...input,
      creditPayment: 'full',
      user: { ...user, id: 'paying-admin', role: 'admin' },
    })
    expect(credit).toHaveBeenCalledWith(expect.objectContaining({ amount: 45, purpose: 'confirmation' }))
    expect(prepared.payment).toMatchObject({
      confirmationPaymentBypassed: true,
      confirmationPaymentBypassedBy: 'prior-admin',
      confirmationPaymentBypassedAt: resultDate,
    })
  })
  test('explicit credit closes an existing unpaid checkout before replacing it with account credit', async () => {
    const { input, payload } = setup({
      confirmationDecision: 'request-confirmation',
      confirmationSubstances: ['amphetamines'],
      confirmationRequestKey: 'request',
      payment: { amountDue: 80, amountPaid: 35, confirmationFeeDue: 45, confirmationFeePaid: 0 },
    })
    payload.find.mockResolvedValueOnce({ docs: [{ id: 'pending-link' }] } as never)
    credit.mockResolvedValueOnce({ usedCredit: 45 })
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_unit')
    try {
      await prepareConfirmation({ ...input, creditPayment: 'full' })
      expect(closeLinks).toHaveBeenCalledWith(payload, expect.anything(), 'test', 'confirmation')
      expect(closeLinks.mock.invocationCallOrder[0]).toBeLessThan(payload.update.mock.invocationCallOrder[0])
    } finally {
      vi.unstubAllEnvs()
    }
  })
  test('lab entry can leave a pending fee without automatically spending available credit', async () => {
    const { input } = setup()
    const pending = await prepareConfirmation({ ...input, creditPayment: 'none' })
    expect(pending.payment).toMatchObject({ confirmationFeeDue: 45, confirmationFeePaid: 0 })
    expect(credit).not.toHaveBeenCalled()
  })
  test('explicit credit funds only the remaining fee for the selected request', async () => {
    credit.mockResolvedValueOnce({ usedCredit: 25 })
    const { input } = setup({
      confirmationDecision: 'request-confirmation',
      confirmationSubstances: ['amphetamines'],
      confirmationRequestKey: 'request',
      payment: { amountDue: 80, amountPaid: 55, confirmationFeeDue: 45, confirmationFeePaid: 20 },
    })
    await prepareConfirmation({ ...input, creditPayment: 'full' })
    expect(credit).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 25,
        relatedDrugTest: 'test',
        purpose: 'confirmation',
        confirmationRequestKey: 'request',
      }),
    )
  })
  test('insufficient credit rejects the explicit payment before changing the request or spending anything', async () => {
    const { input, payload } = setup({
      confirmationDecision: 'request-confirmation',
      confirmationSubstances: ['amphetamines'],
      confirmationRequestKey: 'request',
      payment: { amountDue: 80, amountPaid: 35, confirmationFeeDue: 45, confirmationFeePaid: 0 },
    })
    payload.find.mockResolvedValueOnce({ docs: [{ id: 'pending-link' }] } as never)
    balance.mockResolvedValue(44)
    await expect(prepareConfirmation({ ...input, creditPayment: 'full' })).rejects.toThrow(/credit/i)
    expect(payload.update).not.toHaveBeenCalled()
    expect(credit).not.toHaveBeenCalled()
    expect(closeLinks).not.toHaveBeenCalled()
  })
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
  test('admins can authorize an unpaid confirmation, and clients cannot request one', async () => {
    const { payload, input } = setup({ confirmationNotificationAdmin: 'owner' })
    await expect(
      prepareConfirmation({ ...input, user: { ...user, role: 'admin' }, bypassPaymentRequirement: true }),
    ).resolves.toMatchObject({
      payment: expect.objectContaining({
        confirmationFeeDue: 45,
        confirmationFeePaid: 0,
        confirmationPaymentBypassed: true,
      }),
    })
    expect(payload.update).toHaveBeenCalled()
    expect(credit).not.toHaveBeenCalled()
    await prepareConfirmation({ ...input, user: { ...user, role: 'admin' } })
    expect(payload.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          payment: expect.objectContaining({
            confirmationPaymentBypassed: true,
            confirmationPaymentBypassedBy: user.id,
          }),
        }),
      }),
    )
    await expect(prepareConfirmation({ ...input, user: { ...user, collection: 'clients' } as never })).rejects.toThrow()
  })
})
