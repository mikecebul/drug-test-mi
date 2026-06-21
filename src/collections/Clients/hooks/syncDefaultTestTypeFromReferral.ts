import type { CollectionBeforeChangeHook } from 'payload'

import { resolveRecommendedTestType } from '@/lib/quick-book'

function hasOwnField(data: Record<string, unknown>, field: string): boolean {
  return Object.prototype.hasOwnProperty.call(data, field)
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

export const syncDefaultTestTypeFromReferral: CollectionBeforeChangeHook = async ({
  data,
  operation,
  originalDoc,
  req,
}) => {
  if (!data || typeof data !== 'object') {
    return data
  }

  const dataRecord = data as Record<string, unknown>
  const originalDocRecord = toRecord(originalDoc)
  const referralFieldsChanged = hasOwnField(dataRecord, 'referralType') || hasOwnField(dataRecord, 'referral')

  if (operation === 'update' && !referralFieldsChanged) {
    return data
  }

  const nextDoc = {
    ...originalDocRecord,
    ...dataRecord,
  }

  const recommendation = await resolveRecommendedTestType(
    {
      referralType: typeof nextDoc.referralType === 'string' ? nextDoc.referralType : null,
      referral: nextDoc.referral,
    },
    req.payload.findByID.bind(req.payload),
    'syncDefaultTestTypeFromReferral',
  )

  dataRecord.defaultTestType = recommendation.recommendedTestTypeId || null
  return data
}
