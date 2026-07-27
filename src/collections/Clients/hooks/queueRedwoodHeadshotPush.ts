import type { CollectionAfterChangeHook } from 'payload'

import { queueRedwoodHeadshotUpload } from '@/lib/redwood/queue'
import { REDWOOD_SKIP_HEADSHOT_PUSH_CONTEXT_KEY } from '@/lib/redwood/context'

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
  if (!currentHeadshotId || currentHeadshotId === previousHeadshotId) {
    return doc
  }

  if (!hasDonorId) {
    req.payload.logger.info({
      msg: '[clients] Deferred Redwood headshot upload until donor provisioning is complete',
      clientId: String(doc.id),
      headshotId: currentHeadshotId,
      redwoodSyncStatus: typeof doc?.redwoodSyncStatus === 'string' ? doc.redwoodSyncStatus : null,
    })
    return doc
  }

  try {
    await queueRedwoodHeadshotUpload(String(doc.id), String(req.user.id), req.payload, req)
  } catch (error) {
    req.payload.logger.error({
      msg: '[clients] Failed to queue Redwood headshot upload after client update',
      clientId: String(doc.id),
      headshotId: currentHeadshotId,
      err: error,
    })
  }

  return doc
}
