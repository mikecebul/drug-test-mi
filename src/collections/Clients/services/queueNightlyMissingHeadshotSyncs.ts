import type { Payload } from 'payload'

import { queueRedwoodHeadshotSync } from '@/lib/redwood/queue'

const REDWOOD_READY_SYNC_STATUSES = new Set(['matched-existing', 'synced'])
const HEADSHOT_SYNC_SKIP_STATUSES = new Set(['manual-review', 'queued'])

type ClientLike = {
  id: string
  firstName?: string | null
  lastName?: string | null
  headshot?: unknown
  redwoodSyncStatus?: string | null
  redwoodUniqueId?: string | null
  redwoodDonorId?: string | null
  redwoodHeadshotSyncStatus?: string | null
}

function hasHeadshot(client: ClientLike): boolean {
  if (!client.headshot) return false

  if (typeof client.headshot === 'string') {
    return client.headshot.trim().length > 0
  }

  if (typeof client.headshot === 'object' && client.headshot && 'id' in client.headshot) {
    return Boolean(client.headshot.id)
  }

  return false
}

function canQueueNightlyHeadshotSync(client: ClientLike): boolean {
  if (!client.id || !client.firstName?.trim() || !client.lastName?.trim()) {
    return false
  }

  if (hasHeadshot(client)) {
    return false
  }

  if (client.redwoodHeadshotSyncStatus && HEADSHOT_SYNC_SKIP_STATUSES.has(client.redwoodHeadshotSyncStatus)) {
    return false
  }

  if (client.redwoodDonorId?.trim() || client.redwoodUniqueId?.trim()) {
    return true
  }

  return Boolean(client.redwoodSyncStatus && REDWOOD_READY_SYNC_STATUSES.has(client.redwoodSyncStatus))
}

export async function queueNightlyMissingHeadshotSyncs(payload: Payload): Promise<{
  scannedDrugTests: number
  queuedClientIds: string[]
  skippedClientIds: string[]
  failedClientIds: string[]
}> {
  const queuedClientIds: string[] = []
  const skippedClientIds: string[] = []
  const failedClientIds: string[] = []
  const seenClientIds = new Set<string>()

  let page = 1
  let hasNextPage = true
  let scannedDrugTests = 0

  while (hasNextPage) {
    const batch = await payload.find({
      collection: 'drug-tests',
      page,
      limit: 200,
      depth: 1,
      overrideAccess: true,
      where: {
        relatedClient: {
          exists: true,
        },
      },
      select: {
        relatedClient: true,
      },
    })

    scannedDrugTests += batch.docs.length

    for (const doc of batch.docs) {
      const relatedClient = typeof doc.relatedClient === 'object' && doc.relatedClient ? doc.relatedClient : null
      if (!relatedClient) continue

      const clientId = String(relatedClient.id)
      if (seenClientIds.has(clientId)) continue
      seenClientIds.add(clientId)

      if (!canQueueNightlyHeadshotSync(relatedClient)) {
        skippedClientIds.push(clientId)
        continue
      }

      try {
        await queueRedwoodHeadshotSync(clientId, undefined, payload)
        queuedClientIds.push(clientId)
      } catch (error) {
        failedClientIds.push(clientId)
        payload.logger.error({
          msg: '[redwood-nightly-headshot-sync] Failed to queue nightly Redwood headshot sync',
          clientId,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    hasNextPage = batch.hasNextPage
    page += 1
  }

  payload.logger.info({
    msg: '[redwood-nightly-headshot-sync] Nightly missing-headshot scan complete',
    scannedDrugTests,
    queuedCount: queuedClientIds.length,
    skippedCount: skippedClientIds.length,
    failedCount: failedClientIds.length,
  })

  return {
    scannedDrugTests,
    queuedClientIds,
    skippedClientIds,
    failedClientIds,
  }
}
