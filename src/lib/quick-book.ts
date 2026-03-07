export type RecommendedTestType = {
  recommendedTestTypeId?: string
  recommendedTestTypeValue?: string
}

type FindByIdArgs = {
  collection: 'courts' | 'employers' | 'test-types'
  id: string
  depth?: number
  select?: Record<string, true>
}

type FindByIdLike = <T = any>(args: FindByIdArgs) => Promise<T>

type RelationRef = {
  relationTo: 'courts' | 'employers'
  referralId: string
}

export function buildClientName(firstName: string, lastName: string): string {
  return `${firstName.trim()} ${lastName.trim()}`
}

export function formatPhoneForCal(phone?: string | null): string | undefined {
  if (!phone) return undefined

  const digits = phone.replace(/\D/g, '')

  if (digits.length === 10) {
    return `+1${digits}`
  }

  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`
  }

  return undefined
}

export function extractPreferredTestType(preferredTestType: unknown): RecommendedTestType {
  if (!preferredTestType) return {}

  if (typeof preferredTestType === 'string') {
    return { recommendedTestTypeId: preferredTestType }
  }

  if (typeof preferredTestType === 'object' && preferredTestType !== null) {
    const maybeId =
      'id' in preferredTestType && typeof preferredTestType.id === 'string'
        ? preferredTestType.id
        : undefined
    const maybeValue =
      'value' in preferredTestType && typeof preferredTestType.value === 'string'
        ? preferredTestType.value
        : undefined

    return {
      ...(maybeId ? { recommendedTestTypeId: maybeId } : {}),
      ...(maybeValue ? { recommendedTestTypeValue: maybeValue } : {}),
    }
  }

  return {}
}

export function extractReferralRelation(referral: unknown): RelationRef | null {
  if (!referral || typeof referral !== 'object' || !('relationTo' in referral) || !('value' in referral)) {
    return null
  }

  const relationTo = referral.relationTo
  if (relationTo !== 'courts' && relationTo !== 'employers') {
    return null
  }

  const value = referral.value
  if (typeof value === 'string') {
    return { relationTo, referralId: value }
  }

  if (typeof value === 'object' && value !== null && 'id' in value && typeof value.id === 'string') {
    return { relationTo, referralId: value.id }
  }

  return null
}

export async function resolveRecommendedTestType(
  client: {
    referralType?: string | null
    referral?: unknown
  },
  findByID: FindByIdLike,
  logPrefix = 'quick-book',
): Promise<RecommendedTestType> {
  const referralType = client?.referralType
  if (referralType !== 'court' && referralType !== 'employer') {
    return {}
  }

  const relationRef = extractReferralRelation(client?.referral)
  if (!relationRef) {
    return {}
  }

  if (client?.referral && typeof client.referral === 'object' && 'value' in client.referral) {
    const populatedReferralValue = client.referral.value
    if (typeof populatedReferralValue === 'object' && populatedReferralValue !== null) {
      const extracted = extractPreferredTestType(
        'preferredTestType' in populatedReferralValue ? populatedReferralValue.preferredTestType : undefined,
      )
      if (extracted.recommendedTestTypeId || extracted.recommendedTestTypeValue) {
        return extracted
      }
    }
  }

  let referralDoc: { preferredTestType?: unknown } | null = null
  try {
    referralDoc = await findByID({
      collection: relationRef.relationTo,
      id: relationRef.referralId,
      depth: 1,
      select: {
        preferredTestType: true,
      },
    })
  } catch (error) {
    console.warn(`[${logPrefix}] Failed to load referral recommendation source`, error)
    return {}
  }

  const extractedFromReferral = extractPreferredTestType(referralDoc?.preferredTestType)
  if (!extractedFromReferral.recommendedTestTypeId && !extractedFromReferral.recommendedTestTypeValue) {
    return {}
  }

  if (!extractedFromReferral.recommendedTestTypeValue && extractedFromReferral.recommendedTestTypeId) {
    try {
      const testTypeDoc = await findByID<{ value?: string }>({
        collection: 'test-types',
        id: extractedFromReferral.recommendedTestTypeId,
        depth: 0,
        select: {
          value: true,
        },
      })

      return {
        ...extractedFromReferral,
        ...(testTypeDoc?.value ? { recommendedTestTypeValue: testTypeDoc.value } : {}),
      }
    } catch (error) {
      console.warn(`[${logPrefix}] Failed to resolve test type value for recommendation`, error)
      return extractedFromReferral
    }
  }

  return extractedFromReferral
}
