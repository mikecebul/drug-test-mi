import { beforeEach, expect, test, vi } from 'vitest'
import type { PayloadRequest } from 'payload'
const mocks = vi.hoisted(() => ({ getPayload: vi.fn(), auth: vi.fn(), findByID: vi.fn(), transaction: vi.fn() }))
vi.mock('payload', () => ({ getPayload: mocks.getPayload }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('next/headers', () => ({ headers: vi.fn().mockResolvedValue(new Headers()) }))
vi.mock('@/utilities/revalidateBookingViews', () => ({ revalidateBookingViews: vi.fn() }))
vi.mock('@/collections/Payments/services/withPayloadTransaction', () => ({
  withPayloadTransaction: mocks.transaction,
}))
import { recordBookingPayment } from './actions'
const actor = { id: 'admin-1', collection: 'admins', role: 'admin' } as PayloadRequest['user']
const payload = { auth: mocks.auth, findByID: mocks.findByID, logger: { error: vi.fn() } }
const input = { bookingId: 'booking', method: 'cash' as const, amountReceived: 40, operationId: 'already-recorded' }
beforeEach(() => {
  vi.clearAllMocks()
  mocks.getPayload.mockResolvedValue(payload)
  mocks.auth.mockResolvedValue({ user: actor })
  mocks.findByID.mockResolvedValue({
    payment: { workflowOperationId: 'already-recorded', workflowOperationType: 'record-payment' },
  })
  mocks.transaction.mockImplementation(async (_payload, run, options) =>
    run({ user: options.user, transactionID: 'tx' }),
  )
})
test('ordinary admins retain their identity inside the payment transaction', async () => {
  const result = await recordBookingPayment(input, { payload, user: actor } as unknown as PayloadRequest)
  expect(result.success).toBe(true)
  expect(mocks.transaction).toHaveBeenCalledWith(payload, expect.any(Function), {
    requireTransaction: true,
    user: actor,
  })
  expect(mocks.findByID).toHaveBeenCalledWith(
    expect.objectContaining({ req: expect.objectContaining({ user: actor, transactionID: 'tx' }) }),
  )
})
test('server-action authentication is forwarded to the transaction too', async () => {
  expect((await recordBookingPayment(input)).success).toBe(true)
  expect(mocks.transaction).toHaveBeenCalledWith(payload, expect.any(Function), {
    requireTransaction: true,
    user: actor,
  })
})
test('client principals cannot enter the payment transaction', async () => {
  const user = { id: 'client', collection: 'clients' } as PayloadRequest['user']
  await expect(recordBookingPayment(input, { payload, user } as unknown as PayloadRequest)).rejects.toThrow(
    'admin access',
  )
  expect(mocks.transaction).not.toHaveBeenCalled()
})
