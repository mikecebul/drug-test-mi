import type { Payload } from 'payload'

export type RecipientList = {
  clientEmail: string
  referralEmails: string[]
  referralTitle: string // Organization name (employer, court, etc.)
  referralRecipientsDetailed: Array<{
    name: string
    email: string
  }>
}

/**
 * Extract email recipients from client record
 *
 * Recipients are stored in type-specific groups:
 * - Probation clients: courtInfo.recipients
 * - Employment clients: employmentInfo.recipients
 * - Self-pay clients: selfInfo.recipients (optional) + client's own email
 *
 * For "self" clients: The client's own email is ALWAYS added to referralEmails
 *
 *@param clientId - ID of the client
 * @param payload - Payload instance for database queries
 * @returns Object with client email, array of referral emails, and referral organization name
 */
export async function getRecipients(clientId: string, payload: Payload): Promise<RecipientList> {
  try {
    const client = await payload.findByID({
      collection: 'clients',
      id: clientId,
      depth: 0,
    })

    if (!client) {
      payload.logger.error(`Client not found: ${clientId}`)
      return {
        clientEmail: '',
        referralEmails: [],
        referralTitle: '',
        referralRecipientsDetailed: [],
      }
    }

    const clientEmail = client.email
    const recipientMap = new Map<
      string,
      {
        name: string
        email: string
      }
    >()

    // Get title for referral source (employer name, court name, etc.)
    let referralTitle = ''
    if (client.clientType === 'probation') {
      referralTitle = client.courtInfo?.courtName || 'Court'
    } else if (client.clientType === 'employment') {
      referralTitle = client.employmentInfo?.employerName || 'Employer'
    } else if (client.clientType === 'self') {
      referralTitle = ((client.selfInfo as any)?.referralName as string | undefined)?.trim() || 'Self'
    }

    // Get recipients based on client type
    const recipientSources = {
      probation: client.courtInfo?.recipients,
      employment: client.employmentInfo?.recipients,
      self: client.selfInfo?.recipients,
    }

    const recipientsArray = recipientSources[client.clientType as keyof typeof recipientSources]
    if (Array.isArray(recipientsArray)) {
      recipientsArray.forEach((recipient: any) => {
        const email = typeof recipient.email === 'string' ? recipient.email.trim() : ''
        if (!email) {
          return
        }

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
      })
    }

    // For "self" clients: Always add the client's own email to referralEmails
    // This ensures self clients receive their own test results
    if (client.clientType === 'self') {
      const key = clientEmail.toLowerCase()
      const fallbackName =
        [client.firstName, client.middleInitial, client.lastName].filter(Boolean).join(' ') || 'Self'
      if (!recipientMap.has(key)) {
        recipientMap.set(key, { name: fallbackName, email: clientEmail })
      }
    }

    const referralRecipientsDetailed = Array.from(recipientMap.values())
    const referralEmails = referralRecipientsDetailed.map((recipient) => recipient.email)

    return {
      clientEmail,
      referralEmails,
      referralTitle,
      referralRecipientsDetailed,
    }
  } catch (error) {
    payload.logger.error(`Failed to fetch recipients for client ${clientId}:`, error)
    return {
      clientEmail: '',
      referralEmails: [],
      referralTitle: '',
      referralRecipientsDetailed: [],
    }
  }
}
