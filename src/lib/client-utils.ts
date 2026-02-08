export function formatPersonName(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''

  const firstChar = trimmed.charAt(0)
  if (firstChar >= 'a' && firstChar <= 'z') {
    return firstChar.toUpperCase() + trimmed.slice(1)
  }
  return trimmed
}

export function formatMiddleInitial(value?: string | null): string | undefined {
  if (!value) return undefined
  const trimmed = value.trim()
  if (!trimmed) return undefined
  return trimmed.charAt(0).toUpperCase()
}

export function formatPhoneNumber(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''

  const digits = trimmed.replace(/\D/g, '')
  const normalized = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits

  if (normalized.length !== 10) {
    return trimmed
  }

  return `(${normalized.slice(0, 3)}) ${normalized.slice(3, 6)}-${normalized.slice(6)}`
}
