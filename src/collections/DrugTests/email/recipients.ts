import type { Payload } from 'payload'

export type RecipientList = {
  clientEmail: string
  referralEmails: string[]
  referralTitle: string
  referralPresetId?: string
  hasExplicitReferralRecipients: boolean
  referralRecipientsDetailed: Array<{
    name: string
    email: string
  }>
  clientAdditionalRecipientsDetailed: Array<{
    name: string
    email: string
  }>
}

function normalizeReferralContacts(referralDoc: any): Array<{ name: string; email: string }> {
  const contactMap = new Map<string, { name: string; email: string }>()
  const add = (contact: { name?: string; email?: string }) => {
    const email = typeof contact.email === 'string' ? contact.email.trim() : ''
    if (!email) return
    const key = email.toLowerCase()
    const name = typeof contact.name === 'string' ? contact.name.trim() : ''
    const existing = contactMap.get(key)
    if (!existing) {
      contactMap.set(key, { name, email })
      return
    }
    if (!existing.name && name) {
      contactMap.set(key, { name, email: existing.email })
    }
  }

  for (const contact of referralDoc?.contacts || []) {
    add(contact || {})
  }

  // Legacy fallback
  add({
    name: referralDoc?.mainContactName,
    email: referralDoc?.mainContactEmail,
  })

  for (const row of referralDoc?.recipientEmails || []) {
    add({ email: row?.email })
  }

  return Array.from(contactMap.values())
}

function addRecipient(
  recipientMap: Map<string, { name: string; email: string }>,
  recipient: { name?: string | null; email?: string },
) {
  const email = typeof recipient.email === 'string' ? recipient.email.trim() : ''
  if (!email) return

  const key = email.toLowerCase()
  const name = typeof recipient.name === 'string' ? recipient.name.trim() : ''
  const existing = recipientMap.get(key)

  if (!existing) {
    recipientMap.set(key, { name, email })
    return
  }

  if (!existing.name && name) {
    recipientMap.set(key, { name, email: existing.email })
  }
}

export async function getRecipients(clientId: string, payload: Payload): Promise<RecipientList> {
  try {
    const client = await payload.findByID({
      collection: 'clients',
      id: clientId,
      depth: 1,
      overrideAccess: true,
    })

    if (!client) {
      payload.logger.error(`Client not found: ${clientId}`)
      return {
        clientEmail: '',
        referralEmails: [],
        referralTitle: '',
        referralPresetId: undefined,
        hasExplicitReferralRecipients: false,
        referralRecipientsDetailed: [],
        clientAdditionalRecipientsDetailed: [],
      }
    }

    const disableClientEmails = (client as { disableClientEmails?: boolean }).disableClientEmails === true
    const clientEmail = disableClientEmails ? '' : client.email
    const recipientMap = new Map<string, { name: string; email: string }>()
    const additionalRecipientMap = new Map<string, { name: string; email: string }>()
    const referralContactEmailSet = new Set<string>()

    let referralTitle = ''
    let referralPresetId: string | undefined

    if (client.referralType === 'court' || client.referralType === 'employer') {
      if (client.referral && typeof client.referral === 'object' && 'value' in client.referral) {
        if (typeof client.referral.value === 'string') {
          referralPresetId = client.referral.value
        } else if (
          client.referral.value &&
          typeof client.referral.value === 'object' &&
          'id' in client.referral.value &&
          typeof client.referral.value.id === 'string'
        ) {
          referralPresetId = client.referral.value.id
        }
      }

      const referralDoc =
        client.referral && typeof client.referral === 'object' && 'value' in client.referral
          ? (client.referral.value as any)
          : client.referral

      if (referralDoc && typeof referralDoc === 'object') {
        referralTitle = referralDoc.name || (client.referralType === 'court' ? 'Court' : 'Employer')

        const contacts = normalizeReferralContacts(referralDoc)
        for (const contact of contacts) {
          referralContactEmailSet.add(contact.email.toLowerCase())
          addRecipient(recipientMap, contact)
        }
      }

    }

    const hasUnifiedAdditionalRecipients =
      (client.referralAdditionalRecipients || []).some((recipient) => typeof recipient?.email === 'string' && recipient.email.trim())

    if (client.referralType === 'self') {
      referralTitle = 'Self'

      if (!hasUnifiedAdditionalRecipients && client.selfReferral?.sendToOther) {
        for (const recipient of client.selfReferral.recipients || []) {
          addRecipient(recipientMap, recipient)
          addRecipient(additionalRecipientMap, recipient)
        }
      }
    }

    for (const recipient of client.referralAdditionalRecipients || []) {
      const email = typeof recipient?.email === 'string' ? recipient.email.trim().toLowerCase() : ''
      addRecipient(recipientMap, recipient)
      if (!email || !referralContactEmailSet.has(email)) {
        addRecipient(additionalRecipientMap, recipient)
      }
    }

    const hasExplicitReferralRecipients = recipientMap.size > 0

    if (client.referralType === 'self' && clientEmail) {
      const fallbackName =
        [client.firstName, client.middleInitial, client.lastName].filter(Boolean).join(' ') || 'Self'
      addRecipient(recipientMap, {
        name: fallbackName,
        email: clientEmail,
      })
    }

    const clientAdditionalRecipientsDetailed = Array.from(additionalRecipientMap.values())
    const referralRecipientsDetailed = Array.from(recipientMap.values())
    const referralEmails = referralRecipientsDetailed.map((recipient) => recipient.email)

    return {
      clientEmail,
      referralEmails,
      referralTitle,
      referralPresetId,
      hasExplicitReferralRecipients,
      referralRecipientsDetailed,
      clientAdditionalRecipientsDetailed,
    }
  } catch (error) {
    payload.logger.error(`Failed to fetch recipients for client ${clientId}:`, error)
    return {
      clientEmail: '',
      referralEmails: [],
      referralTitle: '',
      referralPresetId: undefined,
      hasExplicitReferralRecipients: false,
      referralRecipientsDetailed: [],
      clientAdditionalRecipientsDetailed: [],
    }
  }
}
