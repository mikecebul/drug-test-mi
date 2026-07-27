import type { CollectionAfterChangeHook } from 'payload'

import { REDWOOD_SKIP_INACTIVATION_QUEUE_CONTEXT_KEY } from '@/lib/redwood/context'
import { queueRedwoodClientInactivation } from '@/lib/redwood/queue'

const REDWOOD_READY_SYNC_STATUSES = new Set(['matched-existing', 'reactivated-existing', 'synced'])

function isInactive(value: unknown): boolean {
  return value === false || value === 'false'
}

export const queueRedwoodClientInactivationAfterChange: CollectionAfterChangeHook = async ({
  doc,
  operation,
  previousDoc,
  req,
}) => {
  if (operation !== 'update') {
    return doc
  }

  if (req.context?.[REDWOOD_SKIP_INACTIVATION_QUEUE_CONTEXT_KEY]) {
    return doc
  }

  if (!isInactive(doc?.isActive) || isInactive(previousDoc?.isActive)) {
    return doc
  }

  const donorId = typeof doc?.redwoodDonorId === 'string' ? doc.redwoodDonorId.trim() : ''
  const syncStatus = typeof doc?.redwoodSyncStatus === 'string' ? doc.redwoodSyncStatus : ''

  if (!donorId || !REDWOOD_READY_SYNC_STATUSES.has(syncStatus)) {
    req.payload.logger.info({
      msg: '[clients] Skipped auto-queueing Redwood inactivation because client is not Redwood-ready yet',
      clientId: String(doc.id),
      redwoodSyncStatus: syncStatus || null,
    })
    return doc
  }

  try {
    await queueRedwoodClientInactivation(
      String(doc.id),
      req.user?.collection === 'admins' ? String(req.user.id) : undefined,
      req.payload,
      req,
    )
  } catch (error) {
    req.payload.logger.error({
      msg: '[clients] Failed to queue Redwood inactivation after client was marked inactive',
      clientId: String(doc.id),
      err: error,
    })
  }

  return doc
}
