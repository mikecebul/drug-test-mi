import { describe, expect, it, vi } from 'vitest'
import type { Payload } from 'payload'
import { resolveRegistrationReferral } from './registrationNotification'

describe('resolveRegistrationReferral', () => {
  it('uses the name and contacts from a populated polymorphic referral', async () => {
    const findByID = vi.fn()
    const result = await resolveRegistrationReferral({
      doc: {
        email: 'client@example.com',
        referralType: 'court',
        referral: {
          relationTo: 'courts',
          value: {
            id: 'court-id',
            name: 'Charlevoix County 33rd Circuit Court',
            contacts: [{ name: 'Jane Smith', email: 'jane@charlevoixcounty.org' }],
          },
        },
      },
      payload: { findByID, logger: { warn: vi.fn() } } as unknown as Payload,
    })

    expect(findByID).not.toHaveBeenCalled()
    expect(result).toEqual({
      referralName: 'Charlevoix County 33rd Circuit Court',
      referralTypeName: 'Court',
      recipients: [{ name: 'Jane Smith', email: 'jane@charlevoixcounty.org' }],
    })
  })

  it('loads a referral when Payload returns only its ID', async () => {
    const findByID = vi.fn().mockResolvedValue({
      id: 'employer-id',
      name: 'Mock Harbor Manufacturing',
      contacts: [{ name: 'HR', email: 'hr@example.com' }],
    })
    const result = await resolveRegistrationReferral({
      doc: {
        email: 'client@example.com',
        referralType: 'employer',
        referral: { relationTo: 'employers', value: 'employer-id' },
      },
      payload: { findByID, logger: { warn: vi.fn() } } as unknown as Payload,
    })

    expect(findByID).toHaveBeenCalledWith({
      collection: 'employers',
      id: 'employer-id',
      depth: 0,
      overrideAccess: true,
    })
    expect(result.referralName).toBe('Mock Harbor Manufacturing')
    expect(result.recipients).toEqual([{ name: 'HR', email: 'hr@example.com' }])
  })
})
