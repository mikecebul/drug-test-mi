import { describe, expect, it, vi } from 'vitest'
import type { Payload } from 'payload'
import { reserveClientPaymentPayer, setCollectionPayer, releaseClientPaymentPayer } from './booking-payer'

vi.mock('@/collections/Payments/services/withPayloadTransaction', () => ({
  withPayloadTransaction: (_payload: unknown, run: (req: object) => Promise<unknown>) =>
    run({ transactionID: 'test-transaction' }),
}))

function fixture(changes: Record<string, unknown> = {}, billable = true) {
  const booking = {
    id: 'booking-1',
    relatedClient: 'client-1',
    updatedAt: '2026-10-03T12:00:00Z',
    billingResponsibility: { payer: 'referral', referral: { relationTo: 'courts', value: 'court-1' } },
    ...changes,
  }
  const findByID = vi.fn(async ({ collection }) =>
    collection === 'bookings'
      ? booking
      : collection === 'clients'
        ? { referral: { relationTo: 'courts', value: 'court-1' } }
        : { isBillable: billable },
  )
  const update = vi.fn(async ({ data }) => ({ ...booking, ...data }))
  const find = vi.fn().mockResolvedValue({ docs: [] })
  return { payload: { findByID, db: { updateOne: update }, find } as unknown as Payload, update, findByID, find }
}

const choice = {
  bookingId: 'booking-1',
  payer: 'client' as const,
  expectedPayer: 'referral' as const,
  userId: 'admin-1',
}

describe('collection payer boundary', () => {
  it('changes only the booking choice and records the staff member inside the transaction', async () => {
    const { payload, update } = fixture()
    expect(await setCollectionPayer({ ...choice, payload })).toMatchObject({
      payer: 'client',
      referral: null,
      changedBy: 'admin-1',
    })
    expect(update).toHaveBeenCalledTimes(1)
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'bookings',
        req: { transactionID: 'test-transaction' },
        where: { and: [{ id: { equals: 'booking-1' } }, { updatedAt: { equals: '2026-10-03T12:00:00Z' } }] },
      }),
    )
  })
  it.each([
    { payment: { amountPaid: 1 } },
    { payment: { status: 'paid' } },
    { payment: { collectedAt: '2026-10-03' } },
    { sampleCollection: { status: 'collected' } },
    { billingResponsibility: { payer: 'client', paymentOperationId: 'active-card' } },
  ])('rejects settled or active collections: %j', async (change) => {
    const { payload, update } = fixture(change)
    await expect(setCollectionPayer({ ...choice, payload })).rejects.toThrow()
    expect(update).not.toHaveBeenCalled()
  })
  it('rejects a stale payer choice', async () => {
    const { payload, update } = fixture({ billingResponsibility: { payer: 'client' } })
    await expect(setCollectionPayer({ ...choice, payload })).rejects.toThrow('payer changed')
    expect(update).not.toHaveBeenCalled()
  })
  it('rejects an ineligible referral and an existing saved test', async () => {
    const first = fixture({ billingResponsibility: { payer: 'client' } }, false)
    await expect(
      setCollectionPayer({ ...choice, payer: 'referral', expectedPayer: 'client', payload: first.payload }),
    ).rejects.toThrow('not enabled')
    const second = fixture()
    second.find.mockResolvedValue({ docs: [{ id: 'saved-test' }] })
    await expect(setCollectionPayer({ ...choice, payload: second.payload })).rejects.toThrow('saved test')
  })
  it('rejects a concurrent booking update', async () => {
    const { payload, update } = fixture()
    update.mockResolvedValueOnce(null as never)
    await expect(setCollectionPayer({ ...choice, payload })).rejects.toThrow('booking changed')
  })
  it('reserves only client-paid bookings belonging to the expected client', async () => {
    const referral = fixture()
    await expect(reserveClientPaymentPayer(referral.payload, 'booking-1', 'client-1', 'operation-1')).rejects.toThrow(
      'referral pays',
    )
    const client = fixture({ billingResponsibility: { payer: 'client' } })
    await expect(
      reserveClientPaymentPayer(client.payload, 'booking-1', 'different-client', 'operation-1'),
    ).rejects.toThrow('client changed')
    await reserveClientPaymentPayer(client.payload, 'booking-1', 'client-1', 'operation-1')
    expect(client.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          billingResponsibility: { payer: 'client', referral: null, paymentOperationId: 'operation-1' },
        }),
      }),
    )
  })
  it('does not release another operation reservation', async () => {
    const { payload, update } = fixture({
      billingResponsibility: { payer: 'client', paymentOperationId: 'new-operation' },
    })
    await releaseClientPaymentPayer(payload, 'booking-1', 'old-operation')
    expect(update).not.toHaveBeenCalled()
  })
})
