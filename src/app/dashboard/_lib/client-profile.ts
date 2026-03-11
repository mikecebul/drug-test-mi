import type { Client } from '@/payload-types'
import {
  getRedwoodClientUpdateFieldLabel as getRedwoodClientUpdateFieldLabelBase,
  normalizePendingRedwoodClientUpdateFields as normalizePendingRedwoodClientUpdateFieldsBase,
  REDWOOD_PENDING_CLIENT_UPDATE_FIELDS as REDWOOD_PENDING_CLIENT_UPDATE_FIELDS_BASE,
} from '@/collections/Clients/redwoodSyncFields'

export const SUPPORT_EMAIL = 'mike@midrugtest.com'
export const SUPPORT_PHONE_DISPLAY = '(231) 373-6341'
export const SUPPORT_PHONE_HREF = '+12313736341'
export const REDWOOD_PENDING_CLIENT_UPDATE_FIELDS = REDWOOD_PENDING_CLIENT_UPDATE_FIELDS_BASE
export const normalizePendingRedwoodClientUpdateFields = normalizePendingRedwoodClientUpdateFieldsBase
export const getRedwoodClientUpdateFieldLabel = getRedwoodClientUpdateFieldLabelBase

export function formatPhoneDisplay(phone?: string | null) {
  if (!phone) return 'Not provided'

  const digits = phone.replace(/\D/g, '')

  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }

  if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  }

  return phone
}

export function getReferralTypeLabel(type: string) {
  switch (type) {
    case 'court':
      return 'Court'
    case 'employer':
      return 'Employer'
    case 'self':
      return 'Self'
    default:
      return type || 'Referral'
  }
}

export function getReferralDoc(user: Client) {
  return user?.referral && typeof user.referral === 'object' && 'value' in user.referral ? user.referral.value : user?.referral
}

export function getReferralContacts(referralDoc: unknown): Array<{ name: string; email: string }> {
  const map = new Map<string, { name: string; email: string }>()
  const record = referralDoc && typeof referralDoc === 'object' ? referralDoc : {}

  const add = (contact: { name?: string; email?: string }) => {
    const email = typeof contact.email === 'string' ? contact.email.trim() : ''
    if (!email) return

    const key = email.toLowerCase()
    const name = typeof contact.name === 'string' ? contact.name.trim() : ''
    const existing = map.get(key)

    if (!existing) {
      map.set(key, { name, email })
      return
    }

    if (!existing.name && name) {
      map.set(key, { name, email: existing.email })
    }
  }

  const contacts = 'contacts' in record && Array.isArray(record.contacts) ? record.contacts : []
  for (const contact of contacts) {
    add(
      contact && typeof contact === 'object'
        ? {
            name: 'name' in contact && typeof contact.name === 'string' ? contact.name : undefined,
            email: 'email' in contact && typeof contact.email === 'string' ? contact.email : undefined,
          }
        : {},
    )
  }

  add({
    name:
      'mainContactName' in record && typeof record.mainContactName === 'string' ? record.mainContactName : undefined,
    email:
      'mainContactEmail' in record && typeof record.mainContactEmail === 'string' ? record.mainContactEmail : undefined,
  })

  const recipientEmails = 'recipientEmails' in record && Array.isArray(record.recipientEmails) ? record.recipientEmails : []
  for (const row of recipientEmails) {
    add({
      email: row && typeof row === 'object' && 'email' in row && typeof row.email === 'string' ? row.email : undefined,
    })
  }

  return Array.from(map.values())
}

export function getReferralName(referralDoc: unknown): string {
  if (referralDoc && typeof referralDoc === 'object' && 'name' in referralDoc && typeof referralDoc.name === 'string') {
    return referralDoc.name
  }

  return 'Not provided'
}

export function getSelfAdditionalRecipients(user: Client) {
  const recipients = new Map<string, { name?: string; email: string }>()

  const add = (row: { name?: string | null; email?: string | null }) => {
    const email = typeof row?.email === 'string' ? row.email.trim() : ''
    if (!email) return

    const key = email.toLowerCase()
    const name = typeof row?.name === 'string' ? row.name.trim() || undefined : undefined
    const existing = recipients.get(key)

    if (!existing) {
      recipients.set(key, { ...(name ? { name } : {}), email })
      return
    }

    if (!existing.name && name) {
      recipients.set(key, { name, email: existing.email })
    }
  }

  for (const row of user?.selfReferral?.recipients || []) add(row)
  for (const row of user?.referralAdditionalRecipients || []) add(row)

  return Array.from(recipients.values())
}
