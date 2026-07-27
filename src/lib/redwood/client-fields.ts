import { format } from 'date-fns'

export function mapGenderToRedwoodSex(gender: string | null | undefined): string {
  if (!gender) return ''

  const normalized = gender.toLowerCase()
  if (normalized === 'male') return 'M'
  if (normalized === 'female') return 'F'
  return ''
}

export function normalizePhoneForRedwood(phone: string | null | undefined): string {
  const raw = (phone || '').trim()
  if (!raw) return ''

  const digits = raw.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('1')) {
    return digits.slice(1)
  }

  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
  }

  return ''
}

export function formatDateForRedwood(value: string | Date): string {
  if (typeof value === 'string') {
    const trimmedValue = value.trim()
    const dateOnlyMatch = trimmedValue.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (dateOnlyMatch) {
      const [, year, month, day] = dateOnlyMatch
      return `${month}/${day}/${year}`
    }

    const isoDateTimeMatch = trimmedValue.match(/^(\d{4})-(\d{2})-(\d{2})T/)
    if (isoDateTimeMatch) {
      const [, year, month, day] = isoDateTimeMatch
      return `${month}/${day}/${year}`
    }
  }

  const parsed = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid Redwood date value: "${String(value)}"`)
  }

  return format(parsed, 'MM/dd/yyyy')
}
