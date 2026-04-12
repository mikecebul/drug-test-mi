export type RecommendedTestType = {
  recommendedTestTypeId?: string
  recommendedTestTypeValue?: string
}

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
