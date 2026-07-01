import type { Client } from '@/payload-types'
import { getTestTypeBookingLabel } from '@/config/test-types'
import {
  FALLBACK_BOOKING_TEST_TYPES,
  formatPhoneForCal,
  resolveRecommendedTestLabel,
} from '@/lib/quick-book'

export const DEFAULT_BOOKING_CAL_LINK = 'midrugtest'
export const INSTANT_17_PANEL_CAL_LINK = 'midrugtest/instant-17-panel'
export const DRUG_TEST_CAL_LINK = 'midrugtest/drug-test'
export const LCEMS_DRUG_TEST_CAL_LINK = 'midrugtest/lcems-drug-test-booking'
export const UNPAID_BOOKING_CAL_LINK = DRUG_TEST_CAL_LINK

export type CalBookingConfig = Record<string, string | string[] | Record<string, string>>

export function getClientBookingCalLink(client: Pick<Client, 'allowUnpaidBookings'>): string {
  return client.allowUnpaidBookings ? UNPAID_BOOKING_CAL_LINK : DEFAULT_BOOKING_CAL_LINK
}

export function isLCEMSEmployerReferral(referralName?: string | null): boolean {
  const normalizedName = referralName?.trim().toLowerCase()
  if (!normalizedName) return false

  return normalizedName === 'lcems' || normalizedName.includes('lake charlevoix ems')
}

export function getAdminQuickBookCalLink(input?: {
  referralType?: string | null
  referralName?: string | null
}): string {
  if (input?.referralType === 'employer' && isLCEMSEmployerReferral(input.referralName)) {
    return LCEMS_DRUG_TEST_CAL_LINK
  }

  return DRUG_TEST_CAL_LINK
}

// Helper: Extract referral organization name based on client type
function getReferralValue(client: Client): unknown {
  if (client.referralType !== 'court' && client.referralType !== 'employer') {
    return undefined
  }

  if (!client.referral || typeof client.referral !== 'object' || !('value' in client.referral)) {
    return undefined
  }

  return client.referral.value
}

function getReferralName(client: Client): string | undefined {
  switch (client.referralType) {
    case 'court':
    case 'employer':
      const referralValue = getReferralValue(client)
      return referralValue && typeof referralValue === 'object' && 'name' in referralValue
        ? String(referralValue.name || '') || undefined
        : undefined
    case 'self':
    default:
      return undefined
  }
}

export function getReferralPreferredTestType(client: Client): unknown {
  const referralValue = getReferralValue(client)
  if (!referralValue || typeof referralValue !== 'object' || !('preferredTestType' in referralValue)) {
    return undefined
  }

  return referralValue.preferredTestType
}

function getPopulatedPreferredTestLabel(preferredTestType: unknown): string | undefined {
  if (typeof preferredTestType === 'string') {
    return getTestTypeBookingLabel(preferredTestType)
  }

  if (!preferredTestType || typeof preferredTestType !== 'object') {
    return undefined
  }

  const value =
    'value' in preferredTestType && typeof preferredTestType.value === 'string' ? preferredTestType.value : undefined
  const bookingLabel =
    'bookingLabel' in preferredTestType && typeof preferredTestType.bookingLabel === 'string'
      ? preferredTestType.bookingLabel
      : undefined
  const label =
    'label' in preferredTestType && typeof preferredTestType.label === 'string' ? preferredTestType.label : undefined

  return (
    bookingLabel ||
    resolveRecommendedTestLabel(FALLBACK_BOOKING_TEST_TYPES, {
      recommendedTestTypeValue: value,
    }) ||
    label ||
    value
  )
}

function getPreferredTestLabel(client: Client): string | undefined {
  const preferredTestType = getReferralPreferredTestType(client)
  return getPopulatedPreferredTestLabel(preferredTestType)
}

function buildBaseCalConfig(client: Client): CalBookingConfig {
  if (!client.firstName?.trim() || !client.lastName?.trim()) {
    console.error('Client missing required name fields:', {
      hasFirstName: !!client.firstName,
      hasLastName: !!client.lastName,
    })
    throw new Error('Client profile incomplete. Please update your profile before booking.')
  }

  if (!client.email?.trim() || !client.email.includes('@')) {
    console.error('Client has invalid email:', client.email)
    throw new Error('Invalid email address. Please update your profile before booking.')
  }

  const calConfig: CalBookingConfig = {
    name: `${client.firstName.trim()} ${client.lastName.trim()}`,
    email: client.email.trim(),
  }

  const formattedPhone = formatPhoneForCal(client.phone)
  if (formattedPhone) {
    calConfig.attendeePhoneNumber = formattedPhone
  } else if (client.phone) {
    console.warn('Invalid phone number format, excluding from Cal.com booking:', client.phone)
  }

  // Add referral as title if available
  const referralName = getReferralName(client)
  if (referralName) {
    calConfig.title = referralName.trim()
  }

  return calConfig
}

export function buildCalConfig(client: Client): CalBookingConfig {
  const calConfig = buildBaseCalConfig(client)
  const preferredTestLabel = getPreferredTestLabel(client)

  if (preferredTestLabel) {
    calConfig.test = preferredTestLabel
  }

  return calConfig
}
