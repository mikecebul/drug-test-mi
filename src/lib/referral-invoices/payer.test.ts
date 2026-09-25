import { expect, it, vi } from 'vitest'
import type { Payload } from 'payload'
import { isClientBilledToReferral } from './payer'

it('resolves an employer referral as the paying party only when monthly billing is enabled', async () => {
  const findByID = vi.fn(async ({ collection }: { collection: string }) =>
    collection === 'clients'
      ? { referral: { relationTo: 'employers', value: 'employer-1' } }
      : { isBillable: true },
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
