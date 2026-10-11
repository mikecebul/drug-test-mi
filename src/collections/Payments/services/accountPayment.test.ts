import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Payload, PayloadRequest } from 'payload'
import { postAccountPayment } from './accountPayment'

const sendReceipt = vi.hoisted(() => vi.fn().mockResolvedValue({ recipients: ['client@example.test'] }))
vi.mock('./clientReceipt', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./clientReceipt')>()),
  sendClientPaymentReceipt: sendReceipt,
}))
vi.mock('./withPayloadTransaction', () => ({
  withPayloadTransaction: async (
    _payload: unknown,
    run: (req: object) => Promise<unknown>,
    options: { user: unknown; requireTransaction: boolean },
  ) => {
    if (!options.requireTransaction) throw new Error('A transaction must be required')
    return run({ user: options.user, transactionID: 'transaction-1' })
  },
}))

function fixture() {
  const client = {
    id: 'client-1',
    firstName: 'Alex',
    lastName: 'Morgan',
    email: 'client@example.test',
    creditBalance: 0,
  }
  const tests = [
    {
      id: 'referral-debt',
      relatedClient: client.id,
      collectionDate: '2026-10-03T12:00:00Z',
      testType: '11-panel-lab',
      billingResponsibility: { payer: 'referral', referral: { relationTo: 'courts', value: 'court-1' } },
      payment: { amountDue: 80, amountPaid: 0, balanceDue: 80 },
    },
    {
      id: 'client-debt',
      relatedClient: client.id,
      collectionDate: '2026-10-03T12:00:00Z',
      testType: '11-panel-lab',
      billingResponsibility: { payer: 'client' },
      payment: { amountDue: 35, amountPaid: 0, balanceDue: 35 },
    },
  ]
  const payments: Array<Record<string, unknown>> = []
  const find = vi.fn(async ({ collection, where }) => ({
    docs:
      collection === 'drug-tests'
        ? tests.filter((test) => test.payment.balanceDue > 0)
        : payments.filter((payment) => payment.accountOperationId === where?.accountOperationId?.equals),
    hasNextPage: false,
  }))
  const findByID = vi.fn().mockResolvedValue(client)
  const create = vi.fn(async ({ data }) => {
    const payment = { ...data, id: 'payment-1', collectedAt: '2026-10-03T12:00:00Z' }
    payments.push(payment)
    return payment
  })
  const update = vi.fn(async ({ collection, id, data }) => {
    if (collection === 'clients') return Object.assign(client, data)
    if (collection === 'drug-tests')
      return Object.assign(
        tests.find((test) => test.id === id)!,
        data,
      )
    return Object.assign(
      payments.find((payment) => payment.id === id)!,
      data,
    )
  })
  return {
    payload: { find, findByID, create, update, logger: { error: vi.fn() } } as unknown as Payload,
    client,
    tests,
    payments,
    create,
    update,
  }
}
const user = { id: 'admin-1', collection: 'admins', role: 'admin' } as PayloadRequest['user']
const input = { user, clientId: 'client-1', amount: 50, operationId: 'account-operation-1', sendReceipt: true }

describe('account cash payment', () => {
  beforeEach(() => sendReceipt.mockReset().mockResolvedValue({ recipients: ['client@example.test'] }))
  it('pays only client debt, credits the excess, records the staff member, and creates no booking', async () => {
    const f = fixture()
    const result = await postAccountPayment({ ...input, payload: f.payload })
    expect(result).toMatchObject({
      success: true,
      amount: 50,
      appliedAmount: 35,
      creditAdded: 15,
      receipt: { sent: true },
    })
    expect(f.tests[0].payment.balanceDue).toBe(80)
    expect(f.tests[1].payment.balanceDue).toBe(0)
    expect(f.client.creditBalance).toBe(15)
    expect(f.create).toHaveBeenCalledTimes(1)
    expect(f.create).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'payments',
        data: expect.objectContaining({ accountOperationId: input.operationId, collectedBy: 'admin-1' }),
        req: expect.objectContaining({ transactionID: 'transaction-1', user }),
      }),
    )
    expect(f.payments[0]).not.toHaveProperty('relatedBooking', expect.anything())
  })
  it('returns a previously posted operation without applying balances or sending a second receipt', async () => {
    const f = fixture()
    await postAccountPayment({ ...input, payload: f.payload })
    const calls = f.update.mock.calls.length
    const result = await postAccountPayment({ ...input, payload: f.payload })
    expect(result.paymentId).toBe('payment-1')
    expect(f.create).toHaveBeenCalledTimes(1)
    expect(f.update).toHaveBeenCalledTimes(calls)
    expect(sendReceipt).toHaveBeenCalledTimes(1)
    await expect(postAccountPayment({ ...input, clientId: 'another-client', payload: f.payload })).rejects.toThrow(
      'another client',
    )
    await expect(postAccountPayment({ ...input, amount: 40, payload: f.payload })).rejects.toThrow(
      'another client or amount',
    )
  })
  it('keeps a saved payment successful when receipt delivery fails', async () => {
    const f = fixture()
    sendReceipt.mockRejectedValueOnce(new Error('Mail unavailable'))
    expect(await postAccountPayment({ ...input, payload: f.payload })).toMatchObject({
      success: true,
      receipt: { sent: false, error: 'Mail unavailable' },
    })
    expect(f.tests[1].payment.balanceDue).toBe(0)
    expect(f.payments[0].status).toBe('posted')
  })
  it.each([0, -1, NaN, Infinity, 0.001, 10.123])(
    'rejects invalid money %s before reading or writing',
    async (amount) => {
      const f = fixture()
      await expect(postAccountPayment({ ...input, amount, payload: f.payload })).rejects.toThrow('positive amount')
      expect(f.create).not.toHaveBeenCalled()
    },
  )
  it('rejects a client principal', async () => {
    const f = fixture()
    await expect(
      postAccountPayment({
        ...input,
        user: { id: 'client-1', collection: 'clients' } as PayloadRequest['user'],
        payload: f.payload,
      }),
    ).rejects.toThrow('Admin access')
    expect(f.create).not.toHaveBeenCalled()
  })
})
