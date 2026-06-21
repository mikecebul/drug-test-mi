'use server'

import configPromise from '@payload-config'
import { headers } from 'next/headers'
import { getPayload } from 'payload'

import { REDWOOD_SKIP_CLIENT_UPDATE_QUEUE_CONTEXT_KEY } from '@/lib/redwood/context'
import {
  isEligibleForRedwoodClientUpdate,
  isRedwoodClientUpdateQueued,
  normalizePendingRedwoodClientUpdateFields,
  REDWOOD_PENDING_CLIENT_UPDATE_FIELDS,
  type RedwoodClientUpdateField,
} from '../redwoodSyncFields'

export async function clearPendingRedwoodClientSync(
  clientId: string,
): Promise<{ success: boolean; clearedFields?: RedwoodClientUpdateField[]; error?: string }> {
  const payload = await getPayload({ config: configPromise })

  try {
    if (!clientId) {
      return {
        success: false,
        error: 'Client ID is required.',
      }
    }

    const { user } = await payload.auth({ headers: await headers() })

    if (!user || user.collection !== 'admins') {
      return {
        success: false,
        error: 'Unauthorized: admin access required.',
      }
    }

    const client = await payload.findByID({
      collection: 'clients',
      id: clientId,
      depth: 0,
      overrideAccess: true,
    })

    const pendingFields = normalizePendingRedwoodClientUpdateFields(client[REDWOOD_PENDING_CLIENT_UPDATE_FIELDS])

    if (isRedwoodClientUpdateQueued(client.redwoodClientUpdateStatus)) {
      return {
        success: false,
        error: 'A Redwood client sync is already queued for this client.',
      }
    }

    if (pendingFields.length === 0) {
      return {
        success: true,
        clearedFields: [],
      }
    }

    const clientRecord: Record<string, unknown> = { ...client }
    const nextStatus = isEligibleForRedwoodClientUpdate(clientRecord, clientRecord) ? 'synced' : 'not-queued'

    await payload.update({
      collection: 'clients',
      id: client.id,
      data: {
        redwoodClientUpdateLastError: null,
        redwoodClientUpdateStatus: nextStatus,
        [REDWOOD_PENDING_CLIENT_UPDATE_FIELDS]: [],
      },
      context: {
        [REDWOOD_SKIP_CLIENT_UPDATE_QUEUE_CONTEXT_KEY]: true,
      },
      overrideAccess: true,
    })

    return {
      success: true,
      clearedFields: pendingFields,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to clear pending Redwood sync state.'

    payload.logger.error({
      msg: '[clearPendingRedwoodClientSync] Failed to clear pending Redwood sync state',
      clientId,
      error: message,
    })

    return {
      success: false,
      error: message,
    }
  }
}
