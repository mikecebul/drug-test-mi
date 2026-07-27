import type { CollectionBeforeChangeHook } from 'payload'

import { REDWOOD_APPROVED_CLIENT_UPDATE_FIELDS_CONTEXT_KEY } from '@/lib/redwood/context'
import { isRedwoodAutomationEnabled } from '@/lib/redwood/config'
import { getChangedRedwoodClientUpdateFieldsFromPatch, isEligibleForRedwoodClientUpdate } from '../redwoodSyncFields'

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

  const changedFields = getChangedRedwoodClientUpdateFieldsFromPatch(dataRecord, originalDocRecord)

  const nextDoc = {
    ...(originalDoc && typeof originalDoc === 'object' ? originalDoc : {}),
    ...dataRecord,
  }
  const isEligible = isEligibleForRedwoodClientUpdate(nextDoc, originalDocRecord)

  if (changedFields.length > 0 && isEligible && isRedwoodAutomationEnabled()) {
    req.context[REDWOOD_APPROVED_CLIENT_UPDATE_FIELDS_CONTEXT_KEY] = changedFields
  }

  return data
}
