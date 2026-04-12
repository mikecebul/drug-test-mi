import type { CollectionBeforeChangeHook } from 'payload'

import { resolveRecommendedTestType } from '@/lib/quick-book'

export const syncDefaultTestTypeFromReferral: CollectionBeforeChangeHook = async ({ data, req }) => {
  if (!data || typeof data !== 'object') {
    return data
  }

  const recommendation = await resolveRecommendedTestType(
    {
      referralType: 'referralType' in data ? (data.referralType as string | null | undefined) : undefined,
      referral: 'referral' in data ? data.referral : undefined,
    },
    req.payload.findByID.bind(req.payload),
    'syncDefaultTestTypeFromReferral',
  )

  data.defaultTestType = recommendation.recommendedTestTypeId || null
  return data
}
