'use server'

import configPromise from '@payload-config'
import { headers } from 'next/headers'
import { getPayload } from 'payload'

type PreferredContactMethod = 'email' | 'phone' | 'sms'

type UpdateClientContactProfileInput = {
  email?: string
  phone?: string
  preferredContactMethod?: PreferredContactMethod
}

const ALLOWED_CONTACT_METHODS = new Set<PreferredContactMethod>(['email', 'phone', 'sms'])

export async function updateClientContactProfileAction(
  input: UpdateClientContactProfileInput,
): Promise<{ success: boolean; error?: string }> {
  const payload = await getPayload({ config: configPromise })
  let clientId: string | null = null

  try {
    const { user } = await payload.auth({ headers: await headers() })

    if (!user || user.collection !== 'clients') {
      return {
        success: false,
        error: 'Unauthorized - must be logged in as a client.',
      }
    }

    clientId = String(user.id)

    const client = await payload.findByID({
      collection: 'clients',
      id: clientId,
      depth: 0,
      overrideAccess: true,
    })

    const updateData: Record<string, string | null> = {}

    if (typeof input.email === 'string') {
      const nextEmail = input.email.trim().toLowerCase()

      if (!nextEmail) {
        return {
          success: false,
          error: 'Email address is required.',
        }
      }

      if (nextEmail !== (client.email || '').trim().toLowerCase()) {
        updateData.email = nextEmail
      }
    }

    if (typeof input.phone === 'string') {
      const nextPhone = input.phone.trim()
      const currentPhone = typeof client.phone === 'string' ? client.phone.trim() : ''

      if (nextPhone !== currentPhone) {
        updateData.phone = nextPhone || null
      }
    }

    if (typeof input.preferredContactMethod === 'string') {
      if (!ALLOWED_CONTACT_METHODS.has(input.preferredContactMethod)) {
        return {
          success: false,
          error: 'Preferred contact method is invalid.',
        }
      }

      if (input.preferredContactMethod !== client.preferredContactMethod) {
        updateData.preferredContactMethod = input.preferredContactMethod
      }
    }

    if (Object.keys(updateData).length === 0) {
      return {
        success: false,
        error: 'No changes detected.',
      }
    }

    await payload.update({
      collection: 'clients',
      id: clientId,
      data: updateData,
      overrideAccess: true,
    })

    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update profile.'

    payload.logger.error({
      msg: '[updateClientContactProfileAction] Failed to update client contact profile',
      clientId,
      error: message,
    })

    return {
      success: false,
      error: message,
    }
  }
}
