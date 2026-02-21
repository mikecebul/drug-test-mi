import { describe, expect, test } from 'vitest'
import { getRecipients } from '../recipients'

type MockPayload = {
  findByID: (args: { collection: string; id: string; depth: number; overrideAccess: boolean }) => Promise<any>
  logger: {
    error: (...args: unknown[]) => void
  }
}

describe('getRecipients', () => {
  test('merges referral contacts with client-specific additional recipients and dedupes final emails', async () => {
    const payload: MockPayload = {
      findByID: async () => ({
        id: 'client-1',
        email: 'client@example.com',
        firstName: 'John',
        lastName: 'Doe',
        referralType: 'court',
        referral: {
          relationTo: 'courts',
          value: {
            id: 'court-123',
            name: 'District Court',
            contacts: [
              { name: 'Ned Heath', email: 'heathn@alpenacounty.org' },
            ],
          },
        },
        referralAdditionalRecipients: [
          { name: 'Case Manager', email: 'manager@agency.org' },
          { name: 'Duplicate Preset', email: 'HEATHN@ALPENACOUNTY.ORG' },
        ],
      }),
      logger: {
        error: () => {},
      },
    }

    const result = await getRecipients('client-1', payload as any)

    expect(result.referralPresetId).toBe('court-123')
    expect(result.referralEmails).toEqual([
      'heathn@alpenacounty.org',
      'manager@agency.org',
    ])
    expect(result.clientAdditionalRecipientsDetailed).toEqual([
      { name: 'Case Manager', email: 'manager@agency.org' },
    ])
    expect(result.hasExplicitReferralRecipients).toBe(true)
  })

  test('keeps self referral behavior unchanged', async () => {
    const payload: MockPayload = {
      findByID: async () => ({
        id: 'client-2',
        email: 'self@example.com',
        firstName: 'Self',
        lastName: 'Client',
        referralType: 'self',
        selfReferral: {
          sendToOther: false,
          recipients: [],
        },
        referralAdditionalRecipients: [{ name: 'Unused', email: 'unused@example.com' }],
      }),
      logger: {
        error: () => {},
      },
    }

    const result = await getRecipients('client-2', payload as any)

    expect(result.referralTitle).toBe('Self')
    expect(result.referralEmails).toEqual(['unused@example.com', 'self@example.com'])
    expect(result.referralPresetId).toBeUndefined()
    expect(result.clientAdditionalRecipientsDetailed).toEqual([{ name: 'Unused', email: 'unused@example.com' }])
  })
})
