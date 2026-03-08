import type { CollectionAfterChangeHook } from 'payload'

import { normalizePhoneForRedwood } from '@/lib/redwood/client-fields'
import { REDWOOD_SKIP_CLIENT_UPDATE_QUEUE_CONTEXT_KEY } from '@/lib/redwood/context'
import { queueRedwoodClientUpdate } from '@/lib/redwood/queue'

export const REDWOOD_CLIENT_UPDATE_FIELDS = [
  'firstName',
  'middleInitial',
  'lastName',
  'dob',
  'gender',
  'phone',
] as const

export type RedwoodClientUpdateField = (typeof REDWOOD_CLIENT_UPDATE_FIELDS)[number]

const ELIGIBLE_SYNC_STATUSES = new Set(['matched-existing', 'synced'])

function normalizeDateValue(value: unknown): string {
  if (typeof value !== 'string') return ''
  const trimmed = value.trim()
  if (!trimmed) return ''

  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return trimmed.slice(0, 10)
  }

  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) return trimmed

  const year = parsed.getFullYear()
  const month = String(parsed.getMonth() + 1).padStart(2, '0')
  const day = String(parsed.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function normalizeComparableValue(field: RedwoodClientUpdateField, value: unknown): string {
  if (value == null) return ''

  if (field === 'phone') {
    return normalizePhoneForRedwood(typeof value === 'string' ? value : String(value))
  }

  if (field === 'dob') {
    return normalizeDateValue(typeof value === 'string' ? value : String(value))
  }
  return typeof value === 'string' ? value.trim() : String(value).trim()
}

export function getChangedRedwoodClientUpdateFields(
  doc: Record<string, unknown> | undefined,
  previousDoc: Record<string, unknown> | undefined,
): RedwoodClientUpdateField[] {
  return REDWOOD_CLIENT_UPDATE_FIELDS.filter((field) => {
    const currentValue = normalizeComparableValue(field, doc?.[field])
    const previousValue = normalizeComparableValue(field, previousDoc?.[field])
    return currentValue !== previousValue
  })
}

function isEligibleForRedwoodClientUpdate(
  doc: Record<string, unknown> | undefined,
  previousDoc: Record<string, unknown> | undefined,
): boolean {
  const currentStatus = typeof doc?.redwoodSyncStatus === 'string' ? doc.redwoodSyncStatus : ''
  const previousStatus = typeof previousDoc?.redwoodSyncStatus === 'string' ? previousDoc.redwoodSyncStatus : ''
  const hasRedwoodDonorId = Boolean(
    (typeof doc?.redwoodDonorId === 'string' && doc.redwoodDonorId.trim()) ||
      (typeof previousDoc?.redwoodDonorId === 'string' && previousDoc.redwoodDonorId.trim()),
  )

  return hasRedwoodDonorId || ELIGIBLE_SYNC_STATUSES.has(currentStatus) || ELIGIBLE_SYNC_STATUSES.has(previousStatus)
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

  const changedFields = getChangedRedwoodClientUpdateFields(doc, previousDoc)
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
