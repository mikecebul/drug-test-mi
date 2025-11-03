import type { Payload } from 'payload'
import type { Client } from '@/payload-types'

export type RecipientList = {
  clientEmail: string
  referralEmails: string[]
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
 * @param clientId - ID of the client
 * @param payload - Payload instance for database queries
 * @returns Object with client email and array of referral emails
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
      }
    }

    const clientEmail = client.email
    const referralEmails: string[] = []

    // Get recipients based on client type
    const recipientSources = {
      probation: client.courtInfo?.recipients,
      employment: client.employmentInfo?.recipients,
      self: client.selfInfo?.recipients,
    }

    const recipientsArray = recipientSources[client.clientType as keyof typeof recipientSources]
    if (Array.isArray(recipientsArray)) {
      recipientsArray.forEach((recipient: any) => {
        if (recipient.email) {
          referralEmails.push(recipient.email)
        }
      })
    }

    // For "self" clients: Always add the client's own email to referralEmails
    // This ensures self clients receive their own test results
    if (client.clientType === 'self') {
      referralEmails.push(clientEmail)
    }

    // Deduplicate emails (in case client email was also in recipients array)
    const uniqueReferrals = [...new Set(referralEmails)]

    return {
      clientEmail,
      referralEmails: uniqueReferrals,
    }
  } catch (error) {
    payload.logger.error(`Failed to fetch recipients for client ${clientId}:`, error)
    return {
      clientEmail: '',
      referralEmails: [],
    }
  }
}
