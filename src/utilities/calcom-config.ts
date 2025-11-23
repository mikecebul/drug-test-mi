import type { Client } from '@/payload-types'

// Helper: Extract referral organization name based on client type
function getReferralName(client: Client): string | undefined {
  switch (client.clientType) {
    case 'probation':
      return client.courtInfo?.courtName
    case 'employment':
      return client.employmentInfo?.employerName
    case 'self':
    default:
      return undefined
  }
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

  return calConfig
}
