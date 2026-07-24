export const REDWOOD_CLIENT_UPDATE_FIELDS = [
  'firstName',
  'middleInitial',
  'lastName',
  'dob',
  'gender',
  'phone',
] as const

export type RedwoodClientUpdateField = (typeof REDWOOD_CLIENT_UPDATE_FIELDS)[number]

export const REDWOOD_PENDING_CLIENT_UPDATE_FIELDS = 'redwoodPendingSyncFields'

const ELIGIBLE_SYNC_STATUSES = new Set(['matched-existing', 'synced'])

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

export function removePendingRedwoodClientUpdateFields(
  existing: unknown,
  removed: RedwoodClientUpdateField[],
): RedwoodClientUpdateField[] {
  const removeSet = new Set(removed)
  return normalizePendingRedwoodClientUpdateFields(existing).filter((field) => !removeSet.has(field))
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
