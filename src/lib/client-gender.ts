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

export function formatClientGender(value: unknown): string {
  const gender = normalizeClientGender(value)
  return CLIENT_GENDER_OPTIONS.find((option) => option.value === gender)?.label || 'Not specified'
}
