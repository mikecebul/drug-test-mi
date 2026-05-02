import { getAuthenticatedClient } from '@/utilities/auth/getAuthenticatedClient'
import { CalInline } from '@/components/cal-inline'
import type { Client } from '@/payload-types'
import { getPayload } from 'payload'
import config from '@payload-config'
import {
  extractPreferredTestType,
  FALLBACK_BOOKING_TEST_TYPES,
  formatPhoneForCal,
  resolveRecommendedTestLabel,
  type RecommendedTestType,
} from '@/lib/quick-book'
import { getClientBookingCalLink } from '@/utilities/calcom-config'

// Force dynamic rendering for fresh data on every request
export const dynamic = 'force-dynamic'

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

function getReferralPreferredTestType(client: Client): RecommendedTestType {
  if (client.referralType !== 'court' && client.referralType !== 'employer') {
    return {}
  }

  if (!client.referral || typeof client.referral !== 'object' || !('value' in client.referral)) {
    return {}
  }

  const referralValue = client.referral.value
  if (!referralValue || typeof referralValue !== 'object' || !('preferredTestType' in referralValue)) {
    return {}
  }

  return extractPreferredTestType(referralValue.preferredTestType)
}

async function getPreferredTestLabel(client: Client): Promise<string | undefined> {
  if (client.referralType === 'court' || client.referralType === 'employer') {
    const referralValue =
      client.referral && typeof client.referral === 'object' && 'value' in client.referral
        ? client.referral.value
        : null
    const preferredTestType =
      referralValue && typeof referralValue === 'object' && 'preferredTestType' in referralValue
        ? referralValue.preferredTestType
        : null

    if (preferredTestType && typeof preferredTestType === 'object') {
      const bookingLabel =
        'bookingLabel' in preferredTestType && typeof preferredTestType.bookingLabel === 'string'
          ? preferredTestType.bookingLabel
          : undefined
      const label =
        'label' in preferredTestType && typeof preferredTestType.label === 'string'
          ? preferredTestType.label
          : undefined
      const value =
        'value' in preferredTestType && typeof preferredTestType.value === 'string'
          ? preferredTestType.value
          : undefined

      return bookingLabel || label || value
    }
  }

  const recommendation = getReferralPreferredTestType(client)
  if (!recommendation.recommendedTestTypeValue && recommendation.recommendedTestTypeId) {
    try {
      const payload = await getPayload({ config })
      const testType = await payload.findByID({
        collection: 'test-types',
        id: recommendation.recommendedTestTypeId,
        depth: 0,
        select: {
          bookingLabel: true,
          label: true,
          value: true,
        },
      })

      return testType.bookingLabel || testType.label || testType.value || undefined
    } catch (error) {
      console.warn('[SchedulePage] Failed to resolve preferred test type', error)
    }
  }

  return resolveRecommendedTestLabel(FALLBACK_BOOKING_TEST_TYPES, recommendation)
}

export default async function SchedulePage() {
  const client = await getAuthenticatedClient()

  // Build Cal.com config with client data
  const calConfig: Record<string, unknown> = {
    name: `${client.firstName} ${client.lastName}`,
    email: client.email,
  }

  // Add phone if available
  const formattedPhone = formatPhoneForCal(client.phone)
  if (formattedPhone) {
    calConfig.attendeePhoneNumber = formattedPhone
  }

  // Add referral as title if available
  const referralName = getReferralName(client)
  if (referralName) {
    calConfig.title = referralName
  }

  const preferredTestLabel = await getPreferredTestLabel(client)
  if (preferredTestLabel) {
    calConfig.test = preferredTestLabel
  }

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="px-4 lg:px-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Schedule Appointment</h1>
            <p className="text-muted-foreground">
              Select your preferred technician and schedule your drug test
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 lg:px-6">
        <CalInline calUsername={getClientBookingCalLink(client)} config={calConfig} />
      </div>
    </div>
  )
}
