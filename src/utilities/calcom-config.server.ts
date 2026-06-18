import config from '@payload-config'
import { getPayload } from 'payload'

import type { Client } from '@/payload-types'
import {
  buildCalConfig,
  getReferralPreferredTestType,
  type CalBookingConfig,
} from '@/utilities/calcom-config'
import {
  extractPreferredTestType,
  FALLBACK_BOOKING_TEST_TYPES,
  resolveRecommendedTestLabel,
  type RecommendedTestType,
} from '@/lib/quick-book'

async function resolvePreferredTestLabel(recommendation: RecommendedTestType): Promise<string | undefined> {
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
      console.warn('[CalConfig] Failed to resolve preferred test type', error)
    }
  }

  return resolveRecommendedTestLabel(FALLBACK_BOOKING_TEST_TYPES, recommendation)
}

export async function buildClientBookingCalConfig(client: Client): Promise<CalBookingConfig> {
  const calConfig = buildCalConfig(client)

  if (calConfig.test) {
    return calConfig
  }

  const preferredTestLabel = await resolvePreferredTestLabel(
    extractPreferredTestType(getReferralPreferredTestType(client)),
  )

  if (preferredTestLabel) {
    calConfig.test = preferredTestLabel
  }

  return calConfig
}
