import { beforeEach, expect, test, vi } from 'vitest'
import type { Payload } from 'payload'
const mocks = vi.hoisted(() => ({ create: vi.fn(), init: vi.fn(), commit: vi.fn(), rollback: vi.fn() }))
vi.mock('payload', () => ({
  createLocalReq: mocks.create,
  initTransaction: mocks.init,
  commitTransaction: mocks.commit,
  killTransaction: mocks.rollback,
}))
import { withPayloadTransaction, PaymentTransactionsUnavailableError } from './withPayloadTransaction'
const payload = {} as Payload
beforeEach(() => {
  vi.clearAllMocks()
  mocks.create.mockResolvedValue({ transactionID: 'tx' })
  mocks.init.mockResolvedValue(true)
})
test('money cannot be posted when the database cannot start a transaction', async () => {
  mocks.init.mockResolvedValue(false)
  const post = vi.fn()
  await expect(withPayloadTransaction(payload, post, { requireTransaction: true })).rejects.toBeInstanceOf(
    PaymentTransactionsUnavailableError,
  )
  expect(post).not.toHaveBeenCalled()
  expect(mocks.commit).not.toHaveBeenCalled()
})
test('unpaid decisions remain possible without transactions', async () => {
  mocks.init.mockResolvedValue(false)
  await expect(withPayloadTransaction(payload, async () => 'pending')).resolves.toBe('pending')
  expect(mocks.commit).not.toHaveBeenCalled()
})
test('payment errors roll back every write and preserve the authenticated actor', async () => {
  const user = { collection: 'admins', id: 'admin' } as never
  await expect(
    withPayloadTransaction(
      payload,
      async () => {
        throw new Error('Allocation failed')
      },
      { user, requireTransaction: true },
    ),
  ).rejects.toThrow('Allocation failed')
  expect(mocks.create).toHaveBeenCalledWith({ user }, payload)
  expect(mocks.rollback).toHaveBeenCalledOnce()
  expect(mocks.commit).not.toHaveBeenCalled()
})
