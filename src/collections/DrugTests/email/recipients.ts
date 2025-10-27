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
 *
 * Note: All clients have been migrated to use the recipients array format.
 * Legacy single-email fields are kept for documentation but not used for notifications.
 */
export async function getRecipients(clientId: string, payload: Payload): Promise<RecipientList> {
  const client = await payload.findByID({
    collection: 'clients',
    id: clientId,
    depth: 0,
  })

  const clientEmail = client.email
  const referralEmails: string[] = []

  // Extract referral emails based on client type
  if (client.clientType === 'probation' && client.courtInfo) {
    // Recipients array (current format)
    if (Array.isArray(client.courtInfo.recipients) && client.courtInfo.recipients.length > 0) {
      client.courtInfo.recipients.forEach((recipient: any) => {
        if (recipient.email) {
          referralEmails.push(recipient.email)
        }
      })
    }

    // Add CC email if present
    if (client.courtInfo.ccEmail) {
      referralEmails.push(client.courtInfo.ccEmail)
    }
  }

  if (client.clientType === 'employment' && client.employmentInfo) {
    // Recipients array (current format)
    if (
      Array.isArray(client.employmentInfo.recipients) &&
      client.employmentInfo.recipients.length > 0
    ) {
      client.employmentInfo.recipients.forEach((recipient: any) => {
        if (recipient.email) {
          referralEmails.push(recipient.email)
        }
      })
    }
  }

  if (client.clientType === 'self' && client.alternativeRecipient?.email) {
    referralEmails.push(client.alternativeRecipient.email)
  }

  // Deduplicate emails (in case ccEmail duplicates a recipient)
  const uniqueReferrals = [...new Set(referralEmails)]

  return {
    clientEmail,
    referralEmails: uniqueReferrals,
  }
}
