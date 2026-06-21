import { ValidationError, type CollectionBeforeChangeHook } from 'payload'

import { REDWOOD_APPROVED_CLIENT_UPDATE_FIELDS_CONTEXT_KEY } from '@/lib/redwood/context'
import {
  getChangedRedwoodClientUpdateFieldsFromPatch,
  isEligibleForRedwoodClientUpdate,
  REDWOOD_CLIENT_UPDATE_APPROVAL_FIELD,
  REDWOOD_CLIENT_UPDATE_SKIP_SYNC_FIELD,
  REDWOOD_PENDING_CLIENT_UPDATE_FIELDS,
  mergePendingRedwoodClientUpdateFields,
} from '../redwoodSyncFields'

function isApprovalChecked(value: unknown): boolean {
  return value === true || value === 'true' || value === 'on'
}

export const requireRedwoodClientUpdateApproval: CollectionBeforeChangeHook = ({
  data,
  operation,
  originalDoc,
  req,
}) => {
  if (operation !== 'update' || !data || typeof data !== 'object') {
    return data
  }

  const dataRecord = data as Record<string, unknown>
  const originalDocRecord: Record<string, unknown> | undefined =
    originalDoc && typeof originalDoc === 'object' ? { ...(originalDoc as object) } : undefined

  const changedFields = getChangedRedwoodClientUpdateFieldsFromPatch(
    dataRecord,
    originalDocRecord,
  )

  const nextDoc = {
    ...(originalDoc && typeof originalDoc === 'object' ? originalDoc : {}),
    ...dataRecord,
  }
  const isEligible = isEligibleForRedwoodClientUpdate(nextDoc, originalDocRecord)
  const approvalRequested = isApprovalChecked(dataRecord[REDWOOD_CLIENT_UPDATE_APPROVAL_FIELD])
  const bypassRequested = isApprovalChecked(dataRecord[REDWOOD_CLIENT_UPDATE_SKIP_SYNC_FIELD])

  if (changedFields.length > 0 && isEligible) {
    dataRecord[REDWOOD_PENDING_CLIENT_UPDATE_FIELDS] = mergePendingRedwoodClientUpdateFields(
      originalDocRecord?.[REDWOOD_PENDING_CLIENT_UPDATE_FIELDS],
      changedFields,
    )
  }

  if (req.user?.collection !== 'admins') {
    dataRecord[REDWOOD_CLIENT_UPDATE_APPROVAL_FIELD] = false
    dataRecord[REDWOOD_CLIENT_UPDATE_SKIP_SYNC_FIELD] = false
    return data
  }

  if (
    changedFields.length === 0 ||
    !isEligible
  ) {
    dataRecord[REDWOOD_CLIENT_UPDATE_APPROVAL_FIELD] = false
    dataRecord[REDWOOD_CLIENT_UPDATE_SKIP_SYNC_FIELD] = false
    return data
  }

  if (approvalRequested && bypassRequested) {
    throw new ValidationError(
      {
        collection: 'clients',
        errors: [
          {
            message: 'Choose either Redwood sync or save without sync, not both.',
            path: REDWOOD_CLIENT_UPDATE_APPROVAL_FIELD,
          },
        ],
      },
      req.t,
    )
  }

  if (bypassRequested && req.user.role !== 'superAdmin') {
    throw new ValidationError(
      {
        collection: 'clients',
        errors: [
          {
            message: 'Only super-admins can save Redwood-linked identity changes without syncing.',
            path: REDWOOD_CLIENT_UPDATE_SKIP_SYNC_FIELD,
          },
        ],
      },
      req.t,
    )
  }

  if (!approvalRequested && !bypassRequested) {
    throw new ValidationError(
      {
        collection: 'clients',
        errors: [
          {
            message:
              'Review the Redwood sync prompt and choose whether to sync now before saving changes to a Redwood-synced client.',
            path: REDWOOD_CLIENT_UPDATE_APPROVAL_FIELD,
          },
        ],
      },
      req.t,
    )
  }

  if (approvalRequested) {
    req.context[REDWOOD_APPROVED_CLIENT_UPDATE_FIELDS_CONTEXT_KEY] = changedFields
  }

  dataRecord[REDWOOD_CLIENT_UPDATE_APPROVAL_FIELD] = false
  dataRecord[REDWOOD_CLIENT_UPDATE_SKIP_SYNC_FIELD] = false

  return data
}
