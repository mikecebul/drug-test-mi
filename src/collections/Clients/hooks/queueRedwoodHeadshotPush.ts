import type { CollectionAfterChangeHook } from 'payload'

import { queueRedwoodHeadshotUpload } from '@/lib/redwood/queue'
import { REDWOOD_SKIP_HEADSHOT_PUSH_CONTEXT_KEY } from '@/lib/redwood/context'

const ELIGIBLE_REDWOOD_SYNC_STATUSES = new Set(['matched-existing', 'synced'])

function extractRelationshipId(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) {
    return value
  }

  if (value && typeof value === 'object' && 'id' in value && typeof value.id === 'string') {
    return value.id
  }

  return null
}

export const queueRedwoodHeadshotPush: CollectionAfterChangeHook = async ({ doc, previousDoc, req }) => {
  if (req.context?.[REDWOOD_SKIP_HEADSHOT_PUSH_CONTEXT_KEY]) {
    return doc
  }

  if (req.user?.collection !== 'admins') {
    return doc
  }

  const currentHeadshotId = extractRelationshipId(doc?.headshot)
  const previousHeadshotId = extractRelationshipId(previousDoc?.headshot)
  const hasDonorId = typeof doc?.redwoodDonorId === 'string' && doc.redwoodDonorId.trim()
  const currentSyncStatus = typeof doc?.redwoodSyncStatus === 'string' ? doc.redwoodSyncStatus : ''

  if (!currentHeadshotId || currentHeadshotId === previousHeadshotId) {
    return doc
  }

  if (!hasDonorId && !ELIGIBLE_REDWOOD_SYNC_STATUSES.has(currentSyncStatus)) {
    req.payload.logger.info({
      msg: '[clients] Skipped auto-queueing Redwood headshot upload because client is not Redwood-ready yet',
      clientId: String(doc.id),
      headshotId: currentHeadshotId,
      redwoodSyncStatus: currentSyncStatus || null,
    })
    return doc
  }

  try {
    await queueRedwoodHeadshotUpload(String(doc.id), String(req.user.id), req.payload)
  } catch (error) {
    req.payload.logger.error({
      msg: '[clients] Failed to queue Redwood headshot upload after client update',
      clientId: String(doc.id),
      headshotId: currentHeadshotId,
      error: error instanceof Error ? error.message : String(error),
    })
  }

  return doc
}
