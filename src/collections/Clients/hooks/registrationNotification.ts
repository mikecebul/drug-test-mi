import type { Payload } from 'payload'
import { normalizeReferralContacts, normalizeReferralContactsFromDoc, type ReferralContact } from '@/lib/referrals'

type ReferralDocument = {
  id?: string
  name?: string | null
  contacts?: Array<{ name?: string | null; email?: string | null }> | null
  mainContactName?: string | null
  mainContactEmail?: string | null
  contactName?: string | null
  contactEmail?: string | null
  recipientEmails?: Array<{ email?: string | null } | string | null> | null
}

type RegistrationDocument = {
  email?: string | null
  referral?:
    | string
    | {
        relationTo?: 'courts' | 'employers'
        value?: string | ReferralDocument | null
      }
    | null
  referralAdditionalRecipients?: Array<{ name?: string | null; email?: string | null }> | null
  referralType?: string | null
  selfReferral?: {
    recipients?: Array<{ name?: string | null; email?: string | null }> | null
  } | null
}

export type RegistrationReferral = {
  referralName: string
  referralTypeName: string
  recipients: ReferralContact[]
}

function isNotFoundError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return message.toLowerCase().includes('not found') || message.toLowerCase().includes('notfound')
}

function mergeRecipients(
  existing: ReferralContact[],
  additional: Array<{ name?: string | null; email?: string | null }> | null | undefined,
): ReferralContact[] {
  return normalizeReferralContacts([...existing, ...(additional || [])])
}

export async function resolveRegistrationReferral(args: {
  doc: RegistrationDocument
  payload: Payload
}): Promise<RegistrationReferral> {
  const { doc, payload } = args
  const referralTypeName =
    doc.referralType === 'court'
      ? 'Court'
      : doc.referralType === 'employer'
        ? 'Employer'
        : doc.referralType === 'self'
          ? 'Self'
          : 'Unspecified'

  if (doc.referralType === 'self') {
    return {
      referralName: 'Self referral',
      referralTypeName,
      recipients: mergeRecipients(
        normalizeReferralContacts(doc.selfReferral?.recipients || []),
        doc.referralAdditionalRecipients,
      ),
    }
  }

  if (doc.referralType !== 'court' && doc.referralType !== 'employer') {
    return {
      referralName: 'Referral not specified',
      referralTypeName,
      recipients: mergeRecipients([], doc.referralAdditionalRecipients),
    }
  }

  const defaultRelation = doc.referralType === 'court' ? 'courts' : 'employers'
  const relationship =
    doc.referral && typeof doc.referral === 'object' && 'value' in doc.referral ? doc.referral : undefined
  const relationTo = relationship?.relationTo || defaultRelation
  const referralValue = relationship?.value ?? (typeof doc.referral === 'string' ? doc.referral : null)
  let referral: ReferralDocument | null = referralValue && typeof referralValue === 'object' ? referralValue : null

  if (typeof referralValue === 'string' && referralValue) {
    try {
      referral = (await payload.findByID({
        collection: relationTo,
        id: referralValue,
        depth: 0,
        overrideAccess: true,
      })) as ReferralDocument
    } catch (error) {
      if (!isNotFoundError(error)) throw error
      payload.logger.warn(
        `Registration referral no longer exists (${relationTo}:${referralValue}) for client ${doc.email || 'unknown'}.`,
      )
    }
  }

  return {
    referralName: referral?.name?.trim() || `${referralTypeName} referral not specified`,
    referralTypeName,
    recipients: mergeRecipients(normalizeReferralContactsFromDoc(referral), doc.referralAdditionalRecipients),
  }
}
