import type { Client } from '@/payload-types'
import { FALLBACK_BOOKING_TEST_TYPES, resolveRecommendedTestLabel } from '@/lib/quick-book'

export const DEFAULT_BOOKING_CAL_LINK = 'midrugtest'
export const INSTANT_17_PANEL_CAL_LINK = 'midrugtest/instant-17-panel'
export const DRUG_TEST_CAL_LINK = 'midrugtest/drug-test'
export const LCEMS_DRUG_TEST_CAL_LINK = 'midrugtest/lcems-drug-test-booking'
export const UNPAID_BOOKING_CAL_LINK = DRUG_TEST_CAL_LINK

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
function getReferralName(client: Client): string | undefined {
  switch (client.referralType) {
    case 'court':
    case 'employer':
      if (client.referral && typeof client.referral === 'object' && 'value' in client.referral) {
        return typeof client.referral.value === 'object' ? client.referral.value?.name || undefined : undefined
      }
      return undefined
    case 'self':
    default:
      return undefined
  }
}

function getPreferredTestLabel(client: Client): string | undefined {
  if (client.referralType !== 'court' && client.referralType !== 'employer') {
    return undefined
  }

  if (!client.referral || typeof client.referral !== 'object' || !('value' in client.referral)) {
    return undefined
  }

  const referralValue = client.referral.value
  if (!referralValue || typeof referralValue !== 'object' || !('preferredTestType' in referralValue)) {
    return undefined
  }

  const preferredTestType = referralValue.preferredTestType
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
    resolveRecommendedTestLabel(FALLBACK_BOOKING_TEST_TYPES, {
      recommendedTestTypeValue: value,
    }) ||
    bookingLabel ||
    label ||
    value
  )
}

// Helper: Format phone for Cal.com (E.164 format)
function formatPhone(phone?: string | null): string | undefined {
  if (!phone) return undefined

  // Strip all non-digit characters
  const digits = phone.replace(/\D/g, '')

  // Handle US phone numbers (10 digits)
  if (digits.length === 10) {
    return `+1${digits}`
  }

  // Handle numbers that already have country code
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`
  }

  // Invalid format - don't prefill
  return undefined
}

export function buildCalConfig(client: Client): Record<string, any> {
  // Validate required fields
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

  const calConfig: Record<string, any> = {
    name: `${client.firstName.trim()} ${client.lastName.trim()}`,
    email: client.email.trim(),
  }

  // Add phone if available and valid
  const formattedPhone = formatPhone(client.phone)
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

  const preferredTestLabel = getPreferredTestLabel(client)
  if (preferredTestLabel) {
    calConfig.test = preferredTestLabel
  }

  return calConfig
}
