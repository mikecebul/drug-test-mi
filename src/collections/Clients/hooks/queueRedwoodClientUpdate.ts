import type { CollectionAfterChangeHook } from 'payload'

import {
  REDWOOD_APPROVED_CLIENT_UPDATE_FIELDS_CONTEXT_KEY,
  REDWOOD_SKIP_CLIENT_UPDATE_QUEUE_CONTEXT_KEY,
} from '@/lib/redwood/context'
import { isRedwoodAutomationEnabled } from '@/lib/redwood/config'
import { queueRedwoodClientUpdate } from '@/lib/redwood/queue'
import {
  getChangedRedwoodClientUpdateFields,
  isEligibleForRedwoodClientUpdate,
  normalizePendingRedwoodClientUpdateFields,
  REDWOOD_PENDING_CLIENT_UPDATE_FIELDS,
  REDWOOD_CLIENT_UPDATE_FIELDS,
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

  if (!isRedwoodAutomationEnabled()) {
    return doc
  }

  const approvedFields = normalizeApprovedContextFields(
    req.context?.[REDWOOD_APPROVED_CLIENT_UPDATE_FIELDS_CONTEXT_KEY],
  )
  if (approvedFields.length === 0) {
    return doc
  }

  const pendingFields = normalizePendingRedwoodClientUpdateFields(previousDoc?.[REDWOOD_PENDING_CLIENT_UPDATE_FIELDS])
  const changedFields = Array.from(new Set([...approvedFields, ...pendingFields]))

  if (changedFields.length === 0) {
    return doc
  }

  if (!isEligibleForRedwoodClientUpdate(doc, previousDoc)) {
    return doc
  }

  try {
    await queueRedwoodClientUpdate(
      String(doc.id),
      changedFields,
      req.user?.collection === 'admins' ? String(req.user.id) : undefined,
      req.payload,
      req,
    )
  } catch (error) {
    req.payload.logger.error({
      msg: '[clients] Failed to queue Redwood client update after client edit',
      clientId: String(doc.id),
      changedFields,
      err: error,
    })
  }

  return doc
}
