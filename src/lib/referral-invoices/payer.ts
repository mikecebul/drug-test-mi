import type { Payload, PayloadRequest } from 'payload'

function idOf(value: unknown): string | null {
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (value && typeof value === 'object' && 'id' in value) return idOf(value.id)
  return null
}

/** Resolve the current paying party for a client's unpaid tests. */
export async function isClientBilledToReferral(payload: Payload, clientId: string, req?: PayloadRequest) {
  const client = await payload.findByID({ collection: 'clients', id: clientId, depth: 0, overrideAccess: true, req })
  const relationTo = client.referral?.relationTo
  const referralId = idOf(client.referral?.value)
  if ((relationTo !== 'courts' && relationTo !== 'employers') || !referralId) return false
  const referral = await payload.findByID({ collection: relationTo, id: referralId, depth: 0, overrideAccess: true, req })
  return Boolean(referral.isBillable)
}
