import { formatDobISO } from '@/lib/date-utils'
import type { ClientSearchFields } from './types'

type ClientIdentity = {
  firstName?: string | null
  middleInitial?: string | null
  lastName?: string | null
  email?: string | null
  phone?: string | null
  dob?: string | null
}

export function normalizeSearchText(value?: string | null): string {
  return (value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

export function normalizeSearchEmail(value?: string | null): string {
  return (value ?? '').trim().toLowerCase()
}

export function normalizeSearchPhone(value?: string | null): string {
  const digits = (value ?? '').replace(/\D/g, '')
  return digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits
}

export function normalizeSearchDob(value?: string | null): string {
  return formatDobISO(value)
}

export function buildClientSearchFields(client: ClientIdentity): ClientSearchFields {
  const firstName = normalizeSearchText(client.firstName)
  const middleInitial = normalizeSearchText(client.middleInitial)
  const lastName = normalizeSearchText(client.lastName)

  return {
    searchFirstName: firstName,
    searchMiddleInitial: middleInitial,
    searchLastName: lastName,
    searchFullName: [firstName, middleInitial, lastName].filter(Boolean).join(' '),
    searchEmail: normalizeSearchEmail(client.email),
    searchPhone: normalizeSearchPhone(client.phone),
    searchDob: normalizeSearchDob(client.dob),
  }
}

export function looksLikePhoneSearch(value: string): boolean {
  const digits = normalizeSearchPhone(value)
  return digits.length >= 4 && /^[\d\s()+.-]+$/.test(value.trim())
}

export function looksLikeDobSearch(value: string): boolean {
  return Boolean(normalizeSearchDob(value)) && (/[/\-]/.test(value) || /^\d{6}(?:\d{2})?$/.test(value.trim()))
}
