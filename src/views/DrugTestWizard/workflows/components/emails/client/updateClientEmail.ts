'use server'

import { z } from 'zod'
import { getPayload } from 'payload'
import config from '@payload-config'
import { headers } from 'next/headers'
import { createAdminAlert } from '@/lib/admin-alerts'

const updateClientEmailSchema = z.object({
  clientId: z.string().trim().min(1, 'Client ID is required'),
  email: z.string().trim().email('Please enter a valid email address'),
})

type UpdateClientEmailResult = {
  success: boolean
  data?: {
    email: string
  }
  error?: string
}

export async function updateClientEmail(input: unknown): Promise<UpdateClientEmailResult> {
  const payload = await getPayload({ config })

  try {
    const parsed = updateClientEmailSchema.safeParse(input)
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || 'Invalid client email payload',
      }
    }

    const { clientId } = parsed.data
    const nextEmail = parsed.data.email.trim().toLowerCase()

    const headersList = await headers()
    const { user } = await payload.auth({ headers: headersList })

    if (!user || user.collection !== 'admins') {
      return {
        success: false,
        error: 'Unauthorized: Admin access required',
      }
    }

    const duplicate = await payload.find({
      collection: 'clients',
      where: {
        and: [
          { email: { equals: nextEmail } },
          { id: { not_equals: clientId } },
        ],
      },
      limit: 1,
      overrideAccess: true,
      depth: 0,
    })

    if (duplicate.docs.length > 0) {
      return {
        success: false,
        error: 'A client with this email already exists.',
      }
    }

    const existingClient = await payload.findByID({
      collection: 'clients',
      id: clientId,
      depth: 0,
      overrideAccess: true,
    })

    if (!existingClient) {
      return {
        success: false,
        error: 'Client not found.',
      }
    }

    const updatedClient = await payload.update({
      collection: 'clients',
      id: clientId,
      data: {
        email: nextEmail,
        disableClientEmails: false,
      },
      overrideAccess: true,
    })

    return {
      success: true,
      data: {
        email: updatedClient.email,
      },
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    payload.logger.error({
      msg: '[updateClientEmail] Failed to update client email',
      err: error,
      input,
    })

    await createAdminAlert(payload, {
      severity: 'high',
      alertType: 'data-integrity',
      title: 'Failed to update client email',
      message,
      context: {
        input,
        error: message,
      },
    })

    return {
      success: false,
      error: `Failed to update client email: ${message}`,
    }
  }
}
