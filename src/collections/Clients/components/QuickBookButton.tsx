import type { ServerComponentProps } from 'payload'
import { getPayload } from 'payload'
import config from '@payload-config'
import { QuickBookButtonClient } from './QuickBookButton.client'
import { buildClientName, extractPreferredTestType, extractReferralRelation, RecommendedTestType } from '@/lib/quick-book'
import type { Client } from '@/payload-types'
import { getAdminQuickBookCalLink } from '@/utilities/calcom-config'

async function resolveRecommendedTestType(
  payload: Awaited<ReturnType<typeof getPayload>>,
  client: Pick<Client, 'referralType' | 'referral'>,
) {
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
    referralDoc = await payload.findByID({
      collection: relationRef.relationTo,
      id: relationRef.referralId,
      depth: 1,
      select: {
        preferredTestType: true,
      },
    })
  } catch (error) {
    console.warn('[QuickBookButton] Failed to load referral recommendation source', error)
    return {}
  }

  const extractedFromReferral = extractPreferredTestType(referralDoc?.preferredTestType)
  if (!extractedFromReferral.recommendedTestTypeId && !extractedFromReferral.recommendedTestTypeValue) {
    return {}
  }

  if (!extractedFromReferral.recommendedTestTypeValue && extractedFromReferral.recommendedTestTypeId) {
    try {
      const testTypeDoc = await payload.findByID({
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
      } satisfies RecommendedTestType
    } catch (error) {
      console.warn('[QuickBookButton] Failed to resolve test type value for recommendation', error)
      return extractedFromReferral
    }
  }

  return extractedFromReferral
}

function getReferralNameFromValue(referralValue: unknown): string | undefined {
  if (referralValue && typeof referralValue === 'object' && 'name' in referralValue) {
    return typeof referralValue.name === 'string' ? referralValue.name : undefined
  }

  return undefined
}

async function resolveReferralName(
  payload: Awaited<ReturnType<typeof getPayload>>,
  client: Pick<Client, 'referralType' | 'referral'>,
): Promise<string | undefined> {
  if (client.referralType !== 'court' && client.referralType !== 'employer') {
    return undefined
  }

  if (client.referral && typeof client.referral === 'object' && 'value' in client.referral) {
    const referralName = getReferralNameFromValue(client.referral.value)
    if (referralName) return referralName
  }

  const relationRef = extractReferralRelation(client.referral)
  if (!relationRef) {
    return undefined
  }

  try {
    const referralDoc = await payload.findByID({
      collection: relationRef.relationTo,
      id: relationRef.referralId,
      depth: 0,
      select: {
        name: true,
      },
    })

    return getReferralNameFromValue(referralDoc)
  } catch (error) {
    console.warn('[QuickBookButton] Failed to load referral name', error)
    return undefined
  }
}

/**
 * Server component that fetches client data and builds Cal.com config
 * for the Quick Book button in the Clients collection edit view.
 */
export default async function QuickBookButton({ id }: ServerComponentProps) {
  // Don't render on new document creation (no ID yet)
  if (!id) {
    return null
  }

  try {
    const payload = await getPayload({ config })

    // Fetch client data
    const client = await payload.findByID({
      collection: 'clients',
      id: id.toString(),
      depth: 1,
    })

    if (!client) {
      console.error('[QuickBookButton] Client not found:', id)
      return null
    }

    // Validate required fields
    if (!client.firstName?.trim() || !client.lastName?.trim()) {
      console.error('[QuickBookButton] Client missing required name fields')
      return null
    }

    if (!client.email?.trim() || !client.email.includes('@')) {
      console.error('[QuickBookButton] Client has invalid email')
      return null
    }

    // Build base config
    const name = buildClientName(client.firstName, client.lastName)
    const email = client.email.trim()
    const [recommendation, referralName] = await Promise.all([
      resolveRecommendedTestType(payload, client),
      resolveReferralName(payload, client),
    ])
    const calLink = getAdminQuickBookCalLink({
      referralType: client.referralType,
      referralName,
    })

    // Render client component with client data
    return (
      <QuickBookButtonClient
        clientName={name}
        clientEmail={email}
        clientPhone={client.phone || undefined}
        recommendedTestTypeId={recommendation.recommendedTestTypeId}
        recommendedTestTypeValue={recommendation.recommendedTestTypeValue}
        calLink={calLink}
      />
    )
  } catch (error) {
    // Gracefully handle errors (e.g., incomplete profile)
    console.error('[QuickBookButton] Error preparing client data:', error)

    // Return null to hide button if profile is incomplete
    return null
  }
}
