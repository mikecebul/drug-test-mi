'use server'

import { z } from 'zod'
import { getPayload } from 'payload'
import config from '@payload-config'
import { headers } from 'next/headers'
import { createAdminAlert } from '@/lib/admin-alerts'
import { getRecipients } from '@/collections/DrugTests/email/recipients'

const recipientSchema = z.object({
  name: z.string().trim().min(1, 'Recipient name is required'),
  email: z.string().trim().email('Recipient email is invalid'),
})

const updateReferralSchema = z.object({
  clientId: z.string().trim().min(1, 'Client ID is required'),
  clientType: z.enum(['probation', 'employment', 'self']),
  title: z.string().trim().min(1, 'Referral name is required'),
  recipients: z.array(recipientSchema).min(1, 'At least one recipient is required'),
})

type ReferralClientType = z.infer<typeof updateReferralSchema>['clientType']
type ReferralRecipient = z.infer<typeof recipientSchema>

type UpdateReferralResult = {
  success: boolean
  data?: {
    clientType: ReferralClientType
    referralTitle: string
    referralEmails: string[]
    referralRecipientsDetailed: ReferralRecipient[]
  }
  error?: string
}

function normalizeRecipients(recipients: ReferralRecipient[]): ReferralRecipient[] {
  const map = new Map<string, ReferralRecipient>()

  for (const recipient of recipients) {
    const email = recipient.email.trim()
    const name = recipient.name.trim()
    const key = email.toLowerCase()

    const existing = map.get(key)
    if (!existing) {
      map.set(key, { name, email })
      continue
    }

    if (!existing.name && name) {
      map.set(key, { name, email: existing.email })
    }
  }

  return Array.from(map.values())
}

export async function updateClientReferralProfile(input: unknown): Promise<UpdateReferralResult> {
  const payload = await getPayload({ config })

  try {
    const parsed = updateReferralSchema.safeParse(input)
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || 'Invalid referral update payload',
      }
    }

    const { clientId, clientType, title } = parsed.data
    const recipients = normalizeRecipients(parsed.data.recipients)

    const headersList = await headers()
    const { user } = await payload.auth({ headers: headersList })

    if (!user || user.collection !== 'admins') {
      return {
        success: false,
        error: 'Unauthorized: Admin access required',
      }
    }

    const client = await payload.findByID({
      collection: 'clients',
      id: clientId,
      depth: 0,
      overrideAccess: true,
    })

    if (!client) {
      return {
        success: false,
        error: 'Client not found',
      }
    }

    const dataToUpdate: Record<string, unknown> = {
      clientType,
      // Payload group fields cannot be set to null during beforeValidate traversal.
      // Use empty objects to clear stale branch values safely when switching type.
      courtInfo: {},
      employmentInfo: {},
      selfInfo: {},
    }

    if (clientType === 'probation') {
      dataToUpdate.courtInfo = {
        courtName: title,
        recipients,
      }
    }

    if (clientType === 'employment') {
      dataToUpdate.employmentInfo = {
        employerName: title,
        recipients,
      }
    }

    if (clientType === 'self') {
      dataToUpdate.selfInfo = {
        referralName: title,
        recipients,
      }
    }

    await payload.update({
      collection: 'clients',
      id: clientId,
      data: dataToUpdate,
      overrideAccess: true,
    })

    const recipientData = await getRecipients(clientId, payload)

    return {
      success: true,
      data: {
        clientType,
        referralTitle: recipientData.referralTitle,
        referralEmails: recipientData.referralEmails,
        referralRecipientsDetailed: recipientData.referralRecipientsDetailed,
      },
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    payload.logger.error({
      msg: '[updateClientReferralProfile] Failed to update referral profile',
      err: error,
      input,
    })

    await createAdminAlert(payload, {
      severity: 'high',
      alertType: 'data-integrity',
      title: 'Failed to update client referral profile',
      message,
      context: {
        input,
        error: message,
      },
    })

    return {
      success: false,
      error: `Failed to update referral profile: ${message}`,
    }
  }
}
