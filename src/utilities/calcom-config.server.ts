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

function resolvePreferredTestLabel(recommendation: RecommendedTestType): string | undefined {
  return resolveRecommendedTestLabel(FALLBACK_BOOKING_TEST_TYPES, recommendation)
}

export async function buildClientBookingCalConfig(client: Client): Promise<CalBookingConfig> {
  const calConfig = buildCalConfig(client)

  if (calConfig.test) {
    return calConfig
  }

  const preferredTestLabel = resolvePreferredTestLabel(extractPreferredTestType(getReferralPreferredTestType(client)))

  if (preferredTestLabel) {
    calConfig.test = preferredTestLabel
  }

  return calConfig
}
