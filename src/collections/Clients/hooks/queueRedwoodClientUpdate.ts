import type { CollectionAfterChangeHook } from 'payload'

import {
  REDWOOD_APPROVED_CLIENT_UPDATE_FIELDS_CONTEXT_KEY,
  REDWOOD_SKIP_CLIENT_UPDATE_QUEUE_CONTEXT_KEY,
} from '@/lib/redwood/context'
import { queueRedwoodClientUpdate } from '@/lib/redwood/queue'
import {
  getChangedRedwoodClientUpdateFields,
  isEligibleForRedwoodClientUpdate,
  REDWOOD_CLIENT_UPDATE_FIELDS,
  shouldAutoQueueApprovedRedwoodClientUpdate,
  type RedwoodClientUpdateField,
} from '../redwoodSyncFields'

export { getChangedRedwoodClientUpdateFields, isEligibleForRedwoodClientUpdate, REDWOOD_CLIENT_UPDATE_FIELDS }
export type { RedwoodClientUpdateField }

function normalizeApprovedContextFields(value: unknown): RedwoodClientUpdateField[] {
  if (!Array.isArray(value)) {
    return []
  }

  return Array.from(
    new Set(
      value.filter(
        (field): field is RedwoodClientUpdateField =>
          typeof field === 'string' && REDWOOD_CLIENT_UPDATE_FIELDS.includes(field as RedwoodClientUpdateField),
      ),
    ),
  )
}

export const queueRedwoodClientUpdateAfterChange: CollectionAfterChangeHook = async ({
  doc,
  operation,
  previousDoc,
  req,
}) => {
  if (operation !== 'update') {
    return doc
  }

  if (req.context?.[REDWOOD_SKIP_CLIENT_UPDATE_QUEUE_CONTEXT_KEY]) {
    return doc
  }

  const approvedFields = normalizeApprovedContextFields(
    req.context?.[REDWOOD_APPROVED_CLIENT_UPDATE_FIELDS_CONTEXT_KEY],
  )
  const changedFields =
    approvedFields.length > 0 ? approvedFields : getChangedRedwoodClientUpdateFields(doc, previousDoc)

  if (changedFields.length === 0) {
    return doc
  }

  if (approvedFields.length === 0) {
    return doc
  }

  if (!isEligibleForRedwoodClientUpdate(doc, previousDoc)) {
    return doc
  }

  const previousDocRecord: Record<string, unknown> | undefined =
    previousDoc && typeof previousDoc === 'object' ? { ...(previousDoc as object) } : undefined

  if (!shouldAutoQueueApprovedRedwoodClientUpdate(previousDocRecord)) {
    return doc
  }

  try {
    await queueRedwoodClientUpdate(
      String(doc.id),
      changedFields,
      req.user?.collection === 'admins' ? String(req.user.id) : undefined,
      req.payload,
    )
  } catch (error) {
    req.payload.logger.error({
      msg: '[clients] Failed to queue Redwood client update after client edit',
      clientId: String(doc.id),
      changedFields,
      error: error instanceof Error ? error.message : String(error),
    })
  }

  return doc
}
