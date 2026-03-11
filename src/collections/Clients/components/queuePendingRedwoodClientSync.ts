'use server'

import configPromise from '@payload-config'
import { headers } from 'next/headers'
import { getPayload } from 'payload'

import { queueRedwoodClientUpdate } from '@/lib/redwood/queue'
import {
  isRedwoodClientUpdateQueued,
  isEligibleForRedwoodClientUpdate,
  normalizePendingRedwoodClientUpdateFields,
  REDWOOD_PENDING_CLIENT_UPDATE_FIELDS,
} from '../redwoodSyncFields'

export async function queuePendingRedwoodClientSync(
  clientId: string,
): Promise<{ success: boolean; error?: string; jobId?: string }> {
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
        success: false,
        error: 'No pending Redwood client changes are waiting to sync.',
      }
    }

    const clientRecord: Record<string, unknown> = { ...client }

    if (!isEligibleForRedwoodClientUpdate(clientRecord, clientRecord)) {
      return {
        success: false,
        error: 'This client is not currently linked to a Redwood donor record.',
      }
    }

    const queued = await queueRedwoodClientUpdate(String(client.id), pendingFields, String(user.id), payload)

    return {
      success: true,
      jobId: queued.jobId,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to queue pending Redwood sync.'

    payload.logger.error({
      msg: '[queuePendingRedwoodClientSync] Failed to queue pending Redwood sync',
      clientId,
      error: message,
    })

    return {
      success: false,
      error: message,
    }
  }
}
