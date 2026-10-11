import type { Payload, PayloadRequest } from 'payload'

export function payerRelationshipId(value: unknown): string | null {
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (value && typeof value === 'object' && 'id' in value) return payerRelationshipId(value.id)
  return null
}

export type BillingResponsibility = {
  payer: 'client' | 'referral'
  referral?: { relationTo: 'courts' | 'employers'; value: string } | null
}

type PayerRecord = {
  billingResponsibility?: {
    payer?: 'client' | 'referral' | null
    referral?: { relationTo: 'courts' | 'employers'; value: unknown } | null
  } | null
  payment?: { amountPaid?: number | null; status?: string | null; method?: string | null } | null
}

export function recordedBillingResponsibility(record: PayerRecord): BillingResponsibility | null {
  const snapshot = record.billingResponsibility
  if (snapshot?.payer === 'client') return { payer: 'client', referral: null }
  const referralId = payerRelationshipId(snapshot?.referral?.value)
  if (snapshot?.payer === 'referral' && referralId && snapshot.referral) {
    return { payer: 'referral', referral: { relationTo: snapshot.referral.relationTo, value: referralId } }
  }
  if (snapshot?.payer === 'referral')
    throw new Error('The recorded billing referral is missing. Review this record before taking payment.')
  return null
}

/** Snapshots survive referral changes. Only records without a snapshot use the legacy profile rule. */
export async function resolveBillingResponsibility(
  payload: Payload,
  record: PayerRecord,
  clientId: string,
  req?: Partial<PayloadRequest>,
  booking = false,
): Promise<BillingResponsibility> {
  if (
    booking &&
    (record.payment?.status === 'paid' ||
      (record.payment?.amountPaid || 0) > 0 ||
      record.payment?.method === 'pre-paid')
  ) {
    return { payer: 'client', referral: null }
  }
  const recorded = recordedBillingResponsibility(record)
  if (recorded) return recorded
  return resolveClientBillingResponsibility(payload, clientId, req)
}

export async function resolveClientBillingResponsibility(
  payload: Payload,
  clientId: string,
  req?: Partial<PayloadRequest>,
): Promise<BillingResponsibility> {
  const client = await payload.findByID({ collection: 'clients', id: clientId, depth: 0, overrideAccess: true, req })
  const relationTo = client.referral?.relationTo
  const referralId = payerRelationshipId(client.referral?.value)
  if ((relationTo !== 'courts' && relationTo !== 'employers') || !referralId) return { payer: 'client', referral: null }
  const referral = await payload.findByID({
    collection: relationTo,
    id: referralId,
    depth: 0,
    overrideAccess: true,
    req,
  })
  return referral.isBillable
    ? { payer: 'referral', referral: { relationTo, value: referralId } }
    : { payer: 'client', referral: null }
}

export async function isTestBilledToReferral(
  payload: Payload,
  test: PayerRecord & { relatedClient?: unknown },
  req?: Partial<PayloadRequest>,
) {
  const clientId = payerRelationshipId(test.relatedClient)
  if (!clientId) return false
  return (await resolveBillingResponsibility(payload, test, clientId, req)).payer === 'referral'
}

/** Resolve the current paying party for a client's unpaid tests. */
export async function isClientBilledToReferral(payload: Payload, clientId: string, req?: PayloadRequest) {
  return (await resolveClientBillingResponsibility(payload, clientId, req)).payer === 'referral'
}
