import type { Payload } from 'payload'

import { queueRedwoodClientUpdate } from '@/lib/redwood/queue'
import {
  isEligibleForRedwoodClientUpdate,
  normalizePendingRedwoodClientUpdateFields,
  REDWOOD_PENDING_CLIENT_UPDATE_FIELDS,
} from '../redwoodSyncFields'

const CLIENT_UPDATE_SKIP_STATUSES = new Set(['queued'])

type ClientLike = {
  id: string
  firstName?: string | null
  lastName?: string | null
  redwoodClientUpdateStatus?: string | null
  redwoodDonorId?: string | null
  redwoodSyncStatus?: string | null
  redwoodPendingSyncFields?: unknown
}

function getPendingFields(client: ClientLike) {
  return normalizePendingRedwoodClientUpdateFields(client[REDWOOD_PENDING_CLIENT_UPDATE_FIELDS])
}

function canQueueNightlyClientUpdate(client: ClientLike): boolean {
  if (!client.id) {
    return false
  }

  if (CLIENT_UPDATE_SKIP_STATUSES.has(client.redwoodClientUpdateStatus || '')) {
    return false
  }

  if (getPendingFields(client).length === 0) {
    return false
  }

  const clientRecord: Record<string, unknown> = { ...client }

  return isEligibleForRedwoodClientUpdate(clientRecord, clientRecord)
}

export async function queueNightlyPendingClientUpdates(payload: Payload): Promise<{
  failedClientIds: string[]
  queuedClientIds: string[]
  scannedClients: number
  skippedClientIds: string[]
}> {
  const failedClientIds: string[] = []
  const queuedClientIds: string[] = []
  const skippedClientIds: string[] = []

  let page = 1
  let hasNextPage = true
  let scannedClients = 0

  while (hasNextPage) {
    const batch = await payload.find({
      collection: 'clients',
      page,
      limit: 200,
      depth: 0,
      overrideAccess: true,
      where: {
        [REDWOOD_PENDING_CLIENT_UPDATE_FIELDS]: {
          exists: true,
        },
      },
      select: {
        firstName: true,
        lastName: true,
        redwoodClientUpdateStatus: true,
        redwoodDonorId: true,
        redwoodPendingSyncFields: true,
        redwoodSyncStatus: true,
      },
    })

    scannedClients += batch.docs.length

    for (const rawClient of batch.docs) {
      const client = rawClient as unknown as ClientLike
      const clientId = String(client.id)

      if (!canQueueNightlyClientUpdate(client)) {
        skippedClientIds.push(clientId)
        continue
      }

      try {
        await queueRedwoodClientUpdate(clientId, getPendingFields(client), undefined, payload)
        queuedClientIds.push(clientId)
      } catch (error) {
        failedClientIds.push(clientId)
        payload.logger.error({
          msg: '[redwood-nightly-client-update] Failed to queue nightly Redwood client update',
          clientId,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    hasNextPage = batch.hasNextPage
    page += 1
  }

  payload.logger.info({
    msg: '[redwood-nightly-client-update] Nightly pending-client-update scan complete',
    scannedClients,
    queuedCount: queuedClientIds.length,
    skippedCount: skippedClientIds.length,
    failedCount: failedClientIds.length,
  })

  return {
    failedClientIds,
    queuedClientIds,
    scannedClients,
    skippedClientIds,
  }
}
