export const CLIENT_GENDER_VALUES = ['male', 'female', 'prefer-not-to-say'] as const

export type ClientGender = (typeof CLIENT_GENDER_VALUES)[number]

export const CLIENT_GENDER_OPTIONS: Array<{ label: string; value: ClientGender }> = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'prefer-not-to-say', label: 'Prefer not to say' },
]

/** Maps the retired `other` value to the single inclusive fallback option. */
export function normalizeClientGender(value: unknown): ClientGender | undefined {
  if (value === 'other') return 'prefer-not-to-say'
  return CLIENT_GENDER_VALUES.find((gender) => gender === value)
}

export function normalizeBookingGender(value: unknown): Extract<ClientGender, 'female' | 'male'> | undefined {
  if (typeof value !== 'string') return undefined

  const normalized = value.trim().toLowerCase()
  if (normalized === 'male' || normalized === 'm') return 'male'
  if (normalized === 'female' || normalized === 'f') return 'female'
  return undefined
}

function readBookingFieldValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(readBookingFieldValue).find((candidate) => normalizeBookingGender(candidate))
  }
  if (!value || typeof value !== 'object') return value

  const record = value as Record<string, unknown>
  return readBookingFieldValue(record.value ?? record.optionValue)
}

export function getBookingGenderFromInputs(
  input: unknown,
): Extract<ClientGender, 'female' | 'male'> | undefined {
  if (!input || Array.isArray(input) || typeof input !== 'object') return undefined

  const entries = Object.entries(input as Record<string, unknown>)
  for (const [key, value] of entries) {
    if (!['gender', 'sex'].includes(key.replace(/[^a-z]/gi, '').toLowerCase())) continue
    const gender = normalizeBookingGender(readBookingFieldValue(value))
    if (gender) return gender
  }

  for (const [, value] of entries) {
    if (!value || Array.isArray(value) || typeof value !== 'object') continue
    const record = value as Record<string, unknown>
    if (typeof record.label !== 'string' || !/\b(?:gender|sex)\b/i.test(record.label)) continue
    const gender = normalizeBookingGender(readBookingFieldValue(record))
    if (gender) return gender
  }

  return undefined
}

export function formatClientGender(value: unknown): string {
  const gender = normalizeClientGender(value)
  return CLIENT_GENDER_OPTIONS.find((option) => option.value === gender)?.label || 'Not specified'
}

export function getClientGenderBadgeClass(value: unknown): string {
  const gender = normalizeClientGender(value)
  if (gender === 'male') {
    return 'border-blue-600/40 bg-blue-50 text-blue-900 dark:border-blue-400/50 dark:bg-blue-500/20 dark:text-blue-100'
  }
  if (gender === 'female') {
    return 'border-pink-600/40 bg-pink-50 text-pink-900 dark:border-pink-400/50 dark:bg-pink-500/20 dark:text-pink-100'
  }
  return 'border-border bg-muted text-muted-foreground'
}
