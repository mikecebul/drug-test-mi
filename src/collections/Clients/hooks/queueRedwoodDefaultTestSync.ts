import type { CollectionAfterChangeHook } from 'payload'

import { resolveClientRedwoodEligibleDefaultTest } from '@/lib/redwood/default-test'
import { queueRedwoodDefaultTestSync } from '@/lib/redwood/queue'

const REDWOOD_READY_SYNC_STATUSES = new Set(['matched-existing', 'reactivated-existing', 'synced'])

function extractRelationshipId(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) {
    return value
  }

  if (value && typeof value === 'object' && 'id' in value && typeof value.id === 'string') {
    return value.id
  }

  return null
}

async function resolvePreviousSyncedCode(args: {
  doc: Record<string, unknown> | undefined
  previousDefaultTestType: unknown
  req: Parameters<CollectionAfterChangeHook>[0]['req']
}): Promise<string | null> {
  const existingSyncedCode =
    typeof args.doc?.redwoodDefaultTestSyncedCode === 'string' ? args.doc.redwoodDefaultTestSyncedCode.trim() : ''

  if (existingSyncedCode) return existingSyncedCode

  try {
    const resolution = await resolveClientRedwoodEligibleDefaultTest({
      client: {
        defaultTestType: args.previousDefaultTestType,
      },
      payload: args.req.payload,
    })

    return resolution.kind === 'eligible' ? resolution.redwoodLabTestCode : null
  } catch (error) {
    args.req.payload.logger.info({
      msg: '[clients] Could not resolve previous Redwood default-test code for replacement fallback',
      err: error,
    })
    return null
  }
}

export const queueRedwoodDefaultTestSyncAfterChange: CollectionAfterChangeHook = async ({
  doc,
  operation,
  previousDoc,
  req,
}) => {
  if (operation !== 'update') {
    return doc
  }

  const currentDefaultTestTypeId = extractRelationshipId(doc?.defaultTestType)
  const previousDefaultTestTypeId = extractRelationshipId(previousDoc?.defaultTestType)

  if (currentDefaultTestTypeId === previousDefaultTestTypeId) {
    return doc
  }

  const donorId = typeof doc?.redwoodDonorId === 'string' ? doc.redwoodDonorId.trim() : ''
  const uniqueId = typeof doc?.redwoodUniqueId === 'string' ? doc.redwoodUniqueId.trim() : ''
  const syncStatus = typeof doc?.redwoodSyncStatus === 'string' ? doc.redwoodSyncStatus : ''

  if ((!donorId && !uniqueId) || !REDWOOD_READY_SYNC_STATUSES.has(syncStatus)) {
    req.payload.logger.info({
      msg: '[clients] Skipped auto-queueing Redwood default-test sync because client is not Redwood-ready yet',
      clientId: String(doc.id),
      defaultTestType: currentDefaultTestTypeId,
      redwoodSyncStatus: syncStatus || null,
    })
    return doc
  }

  try {
    const previousSyncedCode = await resolvePreviousSyncedCode({
      doc,
      previousDefaultTestType: previousDoc?.defaultTestType,
      req,
    })

    await queueRedwoodDefaultTestSync(String(doc.id), req.payload, req, {
      previousSyncedCode,
    })
  } catch (error) {
    req.payload.logger.error({
      msg: '[clients] Failed to queue Redwood default-test sync after default test change',
      clientId: String(doc.id),
      defaultTestType: currentDefaultTestTypeId,
      err: error,
    })
  }

  return doc
}
