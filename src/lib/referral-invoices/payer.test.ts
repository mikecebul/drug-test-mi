import { expect, it, vi } from 'vitest'
import type { Payload } from 'payload'
import { isClientBilledToReferral, resolveBillingResponsibility, isTestBilledToReferral } from './payer'

it('resolves an employer referral as the paying party only when monthly billing is enabled', async () => {
  const findByID = vi.fn(async ({ collection }: { collection: string }) =>
    collection === 'clients' ? { referral: { relationTo: 'employers', value: 'employer-1' } } : { isBillable: true },
  )
  const payload = { findByID } as unknown as Payload
  expect(await isClientBilledToReferral(payload, 'client-1')).toBe(true)
  expect(findByID).toHaveBeenCalledWith(expect.objectContaining({ collection: 'employers', id: 'employer-1' }))
})

it('does not bill a self-referred client to a referral', async () => {
  const findByID = vi.fn().mockResolvedValue({ referral: { relationTo: 'clients', value: 'client-1' } })
  expect(await isClientBilledToReferral({ findByID } as unknown as Payload, 'client-1')).toBe(false)
  expect(findByID).toHaveBeenCalledTimes(1)
})

it('keeps different payer choices for two tests belonging to the same client', async () => {
  const findByID = vi.fn().mockRejectedValue(new Error('A snapshot must not consult the current referral'))
  const payload = { findByID } as unknown as Payload
  expect(
    await isTestBilledToReferral(payload, { relatedClient: 'client-1', billingResponsibility: { payer: 'client' } }),
  ).toBe(false)
  const snapshot = { payer: 'referral' as const, referral: { relationTo: 'courts' as const, value: 'original-court' } }
  expect(await resolveBillingResponsibility(payload, { billingResponsibility: snapshot }, 'client-1')).toEqual(snapshot)
  expect(findByID).not.toHaveBeenCalled()
})

it.each([{ status: 'paid' }, { amountPaid: 10 }, { method: 'pre-paid' }])(
  'keeps settled legacy bookings client-paid even when their referral now invoices: %j',
  async (payment) => {
    const payload = { findByID: vi.fn() } as unknown as Payload
    expect(await resolveBillingResponsibility(payload, { payment }, 'client-1', undefined, true)).toEqual({
      payer: 'client',
      referral: null,
    })
  },
)

it('retains the legacy referral rule for a test without a recorded choice', async () => {
  const findByID = vi.fn(async ({ collection }) =>
    collection === 'clients' ? { referral: { relationTo: 'courts', value: 'court-1' } } : { isBillable: true },
  )
  expect(await isTestBilledToReferral({ findByID } as unknown as Payload, { relatedClient: 'client-1' })).toBe(true)
})

it('does not charge the client when a recorded referral payer has an incomplete relationship', async () => {
  const findByID = vi.fn()
  await expect(
    resolveBillingResponsibility(
      { findByID } as unknown as Payload,
      { billingResponsibility: { payer: 'referral' } },
      'client-1',
    ),
  ).rejects.toThrow('billing referral is missing')
  expect(findByID).not.toHaveBeenCalled()
})
