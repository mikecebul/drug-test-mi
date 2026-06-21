import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/quick-book', () => ({
  resolveRecommendedTestType: vi.fn().mockResolvedValue({ recommendedTestTypeId: 'test-type-1' }),
}))

import { resolveRecommendedTestType } from '@/lib/quick-book'
import { syncDefaultTestTypeFromReferral } from '../syncDefaultTestTypeFromReferral'

type HookArgs = Parameters<typeof syncDefaultTestTypeFromReferral>[0]

describe('syncDefaultTestTypeFromReferral', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(resolveRecommendedTestType).mockResolvedValue({ recommendedTestTypeId: 'test-type-1' })
  })

  it('leaves defaultTestType untouched on unrelated partial updates', async () => {
    const data = {
      email: 'new@example.com',
    }

    const result = await syncDefaultTestTypeFromReferral({
      data,
      operation: 'update',
      originalDoc: {
        defaultTestType: 'existing-test-type',
        referralType: 'court',
      },
      req: {
        payload: {
          findByID: vi.fn(),
        },
      },
    } as unknown as HookArgs)

    expect(result).toEqual({ email: 'new@example.com' })
    expect(resolveRecommendedTestType).not.toHaveBeenCalled()
  })

  it('uses the original referral type when only the referral relationship changes', async () => {
    const data = {
      referral: {
        relationTo: 'courts',
        value: 'court-1',
      },
    }

    const result = await syncDefaultTestTypeFromReferral({
      data,
      operation: 'update',
      originalDoc: {
        referralType: 'court',
      },
      req: {
        payload: {
          findByID: vi.fn(),
        },
      },
    } as unknown as HookArgs)

    expect(resolveRecommendedTestType).toHaveBeenCalledWith(
      {
        referralType: 'court',
        referral: {
          relationTo: 'courts',
          value: 'court-1',
        },
      },
      expect.any(Function),
      'syncDefaultTestTypeFromReferral',
    )
    expect(result).toMatchObject({
      defaultTestType: 'test-type-1',
    })
  })
})
