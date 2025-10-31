import type { Payload } from 'payload'
import type { Client } from '@/payload-types'

export type RecipientList = {
  clientEmail: string
  referralEmails: string[]
}

/**
 * Extract email recipients from client record
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

    // Extract referral emails based on client type using map pattern
    const recipientSources = {
      probation: client.courtInfo?.recipients,
      employment: client.employmentInfo?.recipients,
    }

    const recipientsArray = recipientSources[client.clientType as keyof typeof recipientSources]
    if (Array.isArray(recipientsArray)) {
      recipientsArray.forEach((recipient: any) => {
        if (recipient.email) {
          referralEmails.push(recipient.email)
        }
      })
    }

    // Handle self type separately (different structure)
    if (client.clientType === 'self' && client.alternativeRecipient?.email) {
      referralEmails.push(client.alternativeRecipient.email)
    }

    // Deduplicate emails
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
