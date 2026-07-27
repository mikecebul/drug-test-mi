'use server'

import config from '@payload-config'
import { headers } from 'next/headers'
import { getPayload } from 'payload'

import { formatDobForPayload } from '@/lib/date-utils'
import { clientBasicsUpdateSchema } from './client-basics-schema'

export type UpdatedClientBasics = {
  id: string
  firstName: string
  middleInitial: string | null
  lastName: string
  dob: string | null
  email: string
  phone: string | null
  gender: 'male' | 'female' | 'prefer-not-to-say' | null
}

type UpdateClientBasicsResult = { success: true; client: UpdatedClientBasics } | { success: false; error: string }

function normalizePhone(value: string | undefined) {
  const digits = (value || '').replace(/\D/g, '')
  if (!digits) return null

  const normalized = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits
  if (normalized.length !== 10) {
    throw new Error('Enter a 10-digit phone number.')
  }

  return normalized
}

export async function updateClientBasics(input: unknown): Promise<UpdateClientBasicsResult> {
  const parsed = clientBasicsUpdateSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || 'Invalid client details.',
    }
  }

  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await headers() })

  if (!user || user.collection !== 'admins') {
    return { success: false, error: 'Admin access is required.' }
  }

  try {
    const email = parsed.data.email.toLowerCase()
    const duplicate = await payload.find({
      collection: 'clients',
      where: {
        and: [{ email: { equals: email } }, { id: { not_equals: parsed.data.clientId } }],
      },
      depth: 0,
      limit: 1,
      overrideAccess: true,
    })

    if (duplicate.docs.length > 0) {
      return { success: false, error: 'A client with this email already exists.' }
    }

    const updated = await payload.update({
      collection: 'clients',
      id: parsed.data.clientId,
      data: {
        firstName: parsed.data.firstName,
        middleInitial: parsed.data.middleInitial?.toUpperCase() || null,
        lastName: parsed.data.lastName,
        dob: formatDobForPayload(parsed.data.dob),
        email,
        phone: normalizePhone(parsed.data.phone),
        gender: parsed.data.gender || null,
      },
      overrideAccess: false,
      user,
    })

    return {
      success: true,
      client: {
        id: String(updated.id),
        firstName: updated.firstName,
        middleInitial: updated.middleInitial || null,
        lastName: updated.lastName,
        dob: updated.dob || null,
        email: updated.email,
        phone: updated.phone || null,
        gender: updated.gender || null,
      },
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Client details could not be updated.'
    payload.logger.error({
      err: error,
      msg: '[updateClientBasics] Failed to update client',
    })
    return { success: false, error: message }
  }
}
