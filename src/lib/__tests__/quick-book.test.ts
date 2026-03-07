import { describe, expect, it, vi } from 'vitest'

import { resolveRecommendedTestType } from '@/lib/quick-book'

describe('resolveRecommendedTestType', () => {
  it('returns the populated referral preferred test type without extra queries', async () => {
    const findByID = vi.fn()

    const result = await resolveRecommendedTestType(
      {
        referralType: 'employer',
        referral: {
          relationTo: 'employers',
          value: {
            id: 'employer-1',
            preferredTestType: {
              id: 'test-1',
              value: '15-panel-instant',
            },
          },
        },
      },
      findByID,
    )

    expect(result).toEqual({
      recommendedTestTypeId: 'test-1',
      recommendedTestTypeValue: '15-panel-instant',
    })
    expect(findByID).not.toHaveBeenCalled()
  })

  it('resolves the test type value from the referral document when needed', async () => {
    const findByID = vi
      .fn()
      .mockResolvedValueOnce({
        preferredTestType: 'test-2',
      })
      .mockResolvedValueOnce({
        value: '11-panel-lab',
      })

    const result = await resolveRecommendedTestType(
      {
        referralType: 'court',
        referral: {
          relationTo: 'courts',
          value: 'court-1',
        },
      },
      findByID,
    )

    expect(result).toEqual({
      recommendedTestTypeId: 'test-2',
      recommendedTestTypeValue: '11-panel-lab',
    })
  })
})
