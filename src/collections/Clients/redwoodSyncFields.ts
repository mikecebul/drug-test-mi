export const REDWOOD_CLIENT_UPDATE_FIELDS = [
  'firstName',
  'middleInitial',
  'lastName',
  'dob',
  'gender',
  'phone',
] as const

export type RedwoodClientUpdateField = (typeof REDWOOD_CLIENT_UPDATE_FIELDS)[number]
export type RedwoodClientUpdateSaveBehavior = 'queue-now' | 'save-pending'
export type RedwoodPendingSyncMode = 'hidden' | 'queued' | 'ready'

export const REDWOOD_CLIENT_UPDATE_APPROVAL_FIELD = 'approveRedwoodSync'
export const REDWOOD_CLIENT_UPDATE_SKIP_SYNC_FIELD = 'skipRedwoodSync'
export const REDWOOD_PENDING_CLIENT_UPDATE_FIELDS = 'redwoodPendingSyncFields'

const ELIGIBLE_SYNC_STATUSES = new Set(['matched-existing', 'synced'])
const QUEUED_CLIENT_UPDATE_STATUSES = new Set(['queued'])

function normalizePhoneForComparison(value: string): string {
  return value.replace(/\D/g, '')
}

function normalizeDateValue(value: unknown): string {
  if (typeof value !== 'string') return ''
  const trimmed = value.trim()
  if (!trimmed) return ''

  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return trimmed.slice(0, 10)
  }

  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) return trimmed

  const year = parsed.getUTCFullYear()
  const month = String(parsed.getUTCMonth() + 1).padStart(2, '0')
  const day = String(parsed.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function normalizeComparableRedwoodFieldValue(field: RedwoodClientUpdateField, value: unknown): string {
  if (value == null) return ''

  if (field === 'phone') {
    return normalizePhoneForComparison(typeof value === 'string' ? value : String(value))
  }

  if (field === 'dob') {
    return normalizeDateValue(typeof value === 'string' ? value : String(value))
  }

  return typeof value === 'string' ? value.trim() : String(value).trim()
}

function hasOwnField(record: Record<string, unknown> | undefined, field: RedwoodClientUpdateField): boolean {
  return Boolean(record && Object.prototype.hasOwnProperty.call(record, field))
}

export function getChangedRedwoodClientUpdateFields(
  doc: Record<string, unknown> | undefined,
  previousDoc: Record<string, unknown> | undefined,
): RedwoodClientUpdateField[] {
  return REDWOOD_CLIENT_UPDATE_FIELDS.filter((field) => {
    const currentValue = normalizeComparableRedwoodFieldValue(field, doc?.[field])
    const previousValue = normalizeComparableRedwoodFieldValue(field, previousDoc?.[field])
    return currentValue !== previousValue
  })
}

export function getChangedRedwoodClientUpdateFieldsFromPatch(
  data: Record<string, unknown> | undefined,
  previousDoc: Record<string, unknown> | undefined,
): RedwoodClientUpdateField[] {
  return REDWOOD_CLIENT_UPDATE_FIELDS.filter((field) => {
    if (!hasOwnField(data, field)) {
      return false
    }

    const currentValue = normalizeComparableRedwoodFieldValue(field, data?.[field])
    const previousValue = normalizeComparableRedwoodFieldValue(field, previousDoc?.[field])
    return currentValue !== previousValue
  })
}

export function isEligibleForRedwoodClientUpdate(
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

export function normalizePendingRedwoodClientUpdateFields(value: unknown): RedwoodClientUpdateField[] {
  if (!Array.isArray(value)) {
    return []
  }

  const normalized = new Set(
    value.filter(
      (field): field is RedwoodClientUpdateField =>
        typeof field === 'string' && REDWOOD_CLIENT_UPDATE_FIELDS.includes(field as RedwoodClientUpdateField),
    ),
  )

  return REDWOOD_CLIENT_UPDATE_FIELDS.filter((field) => normalized.has(field))
}

export function mergePendingRedwoodClientUpdateFields(
  existing: unknown,
  added: RedwoodClientUpdateField[],
): RedwoodClientUpdateField[] {
  return Array.from(new Set([...normalizePendingRedwoodClientUpdateFields(existing), ...added]))
}

export function removePendingRedwoodClientUpdateFields(
  existing: unknown,
  removed: RedwoodClientUpdateField[],
): RedwoodClientUpdateField[] {
  const removeSet = new Set(removed)
  return normalizePendingRedwoodClientUpdateFields(existing).filter((field) => !removeSet.has(field))
}

export function isRedwoodClientUpdateQueued(value: unknown): boolean {
  return typeof value === 'string' && QUEUED_CLIENT_UPDATE_STATUSES.has(value)
}

export function resolveRedwoodClientUpdateSaveBehavior(args: {
  pendingFields: unknown
  redwoodClientUpdateStatus: unknown
}): RedwoodClientUpdateSaveBehavior {
  return normalizePendingRedwoodClientUpdateFields(args.pendingFields).length > 0 ||
    isRedwoodClientUpdateQueued(args.redwoodClientUpdateStatus)
    ? 'save-pending'
    : 'queue-now'
}

export function resolveRedwoodPendingSyncMode(args: {
  eligible: boolean
  pendingFields: unknown
  redwoodClientUpdateStatus: unknown
}): RedwoodPendingSyncMode {
  const pendingFields = normalizePendingRedwoodClientUpdateFields(args.pendingFields)

  if (!args.eligible || pendingFields.length === 0) {
    return 'hidden'
  }

  return isRedwoodClientUpdateQueued(args.redwoodClientUpdateStatus) ? 'queued' : 'ready'
}

export function shouldAutoQueueApprovedRedwoodClientUpdate(previousDoc: Record<string, unknown> | undefined): boolean {
  return (
    resolveRedwoodClientUpdateSaveBehavior({
      pendingFields: previousDoc?.[REDWOOD_PENDING_CLIENT_UPDATE_FIELDS],
      redwoodClientUpdateStatus: previousDoc?.redwoodClientUpdateStatus,
    }) === 'queue-now'
  )
}

export function getRedwoodClientUpdateFieldLabel(field: RedwoodClientUpdateField): string {
  switch (field) {
    case 'firstName':
      return 'First name'
    case 'middleInitial':
      return 'Middle initial'
    case 'lastName':
      return 'Last name'
    case 'dob':
      return 'Date of birth'
    case 'gender':
      return 'Gender'
    case 'phone':
      return 'Phone'
    default:
      return field
  }
}
