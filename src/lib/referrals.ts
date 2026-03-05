import type { Payload } from 'payload'
import { createAdminAlert } from '@/lib/admin-alerts'

export type ReferralType = 'court' | 'employer'

export type ReferralRelationship = {
  relationTo: 'courts' | 'employers'
  value: string
}

export type ReferralContact = {
  name?: string
  email: string
}

export type ReferralRelation = 'courts' | 'employers'

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function parseRecipientEmails(input?: string | null): string[] {
  if (!input) return []

  const deduped = new Map<string, string>()
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  input
    .split(/[\n,;]/)
    .map((value) => value.trim())
    .filter(Boolean)
    .forEach((email) => {
      if (!emailPattern.test(email)) return
      const key = normalizeEmail(email)
      if (!deduped.has(key)) {
        deduped.set(key, email)
      }
    })

  return Array.from(deduped.values())
}

export function normalizeReferralContacts(
  input: Array<{ name?: string | null; email?: string | null }>,
): ReferralContact[] {
  const deduped = new Map<string, ReferralContact>()

  input.forEach((raw) => {
    const email = raw.email?.trim()
    if (!email) return
    const key = normalizeEmail(email)
    const name = raw.name?.trim() || undefined
    const existing = deduped.get(key)
    if (!existing) {
      deduped.set(key, { name, email })
      return
    }
    if (!existing.name && name) {
      deduped.set(key, { name, email: existing.email })
    }
  })

  return Array.from(deduped.values())
}

export function buildContactsFromLegacyInput(
  mainContactName: string,
  mainContactEmail: string,
  additionalEmails: string[],
): ReferralContact[] {
  const trailingContacts = additionalEmails.map((email) => ({ email }))
  return normalizeReferralContacts([
    { name: mainContactName, email: mainContactEmail },
    ...trailingContacts,
  ])
}

export function normalizeReferralContactsFromDoc(
  doc: {
    contacts?: Array<{ name?: string | null; email?: string | null }> | null
    mainContactName?: string | null
    mainContactEmail?: string | null
    contactName?: string | null
    contactEmail?: string | null
    recipientEmails?: Array<{ email?: string | null } | string | null> | null
  } | null | undefined,
): ReferralContact[] {
  return normalizeReferralContacts([
    ...((doc?.contacts || []) as Array<{ name?: string | null; email?: string | null }>),
    {
      name: doc?.mainContactName || doc?.contactName,
      email: doc?.mainContactEmail || doc?.contactEmail,
    },
    ...((doc?.recipientEmails || []).map((row) =>
      typeof row === 'string' ? { email: row } : { email: row?.email },
    ) as Array<{ email?: string | null }>),
  ])
}

export async function assertReferralHasContacts(args: {
  payload: Payload
  relationTo: ReferralRelation
  referralId: string
}) {
  const referralDoc = await args.payload.findByID({
    collection: args.relationTo,
    id: args.referralId,
    depth: 0,
    overrideAccess: true,
  })

  const contacts = normalizeReferralContactsFromDoc(referralDoc as any)
  if (contacts.length === 0) {
    const referralTypeLabel = args.relationTo === 'courts' ? 'court' : 'employer'
    throw new Error(
      `Selected ${referralTypeLabel} referral has no recipient contacts. Add at least one contact to continue.`,
    )
  }

  return contacts
}

export async function createInactiveReferralAndAlert(args: {
  payload: Payload
  type: ReferralType
  source: 'frontend' | 'admin' | 'referral-editor'
  name: string
  contacts: ReferralContact[]
  preferredTestTypeId?: string | null
}): Promise<ReferralRelationship> {
  const relationTo = args.type === 'court' ? 'courts' : 'employers'
  const contacts = normalizeReferralContacts(args.contacts)
  if (contacts.length === 0) {
    throw new Error(`At least one referral contact is required for ${args.type}.`)
  }

  const created = await args.payload.create({
    collection: relationTo,
    data: {
      name: args.name,
      contacts: contacts.map((contact) => ({
        ...(contact.name ? { name: contact.name } : {}),
        email: contact.email,
      })),
      isActive: false,
      ...(args.preferredTestTypeId ? { preferredTestType: args.preferredTestTypeId } : {}),
    },
    overrideAccess: true,
  })

  await createAdminAlert(args.payload, {
    severity: 'high',
    alertType: 'data-integrity',
    title: `New inactive ${args.type} referral created from ${args.source}`,
    message: `Review referral and set active when approved: ${args.name}`,
    context: {
      source: args.source,
      referralType: args.type,
      referralId: created.id,
      relationTo,
      name: args.name,
      contacts,
    },
  })

  return {
    relationTo,
    value: created.id,
  }
}

export function relationToFromReferralType(referralType: 'court' | 'employer'): 'courts' | 'employers' {
  return referralType === 'court' ? 'courts' : 'employers'
}
