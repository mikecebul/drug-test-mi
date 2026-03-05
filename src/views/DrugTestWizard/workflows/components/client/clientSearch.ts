import Fuse from 'fuse.js'
import type { IFuseOptions } from 'fuse.js'
import type { SimpleClient } from './getClients'

export const CLIENT_SEARCH_MIN_CHARS = 2
export const RECENT_CLIENT_LIMIT = 25
export const SEARCH_RESULT_LIMIT = 50

type IndexedClient = SimpleClient & {
  searchPhoneDigits: string
  searchDobTokens: string
}

const FUSE_OPTIONS: IFuseOptions<IndexedClient> = {
  threshold: 0.3,
  ignoreLocation: true,
  includeScore: true,
  minMatchCharLength: CLIENT_SEARCH_MIN_CHARS,
  keys: [
    { name: 'firstName', weight: 0.35 },
    { name: 'lastName', weight: 0.2 },
    { name: 'fullName', weight: 0.18 },
    { name: 'email', weight: 0.15 },
    { name: 'phone', weight: 0.07 },
    { name: 'searchPhoneDigits', weight: 0.03 },
    { name: 'searchDobTokens', weight: 0.02 },
  ],
}

function toTimestamp(value?: string): number {
  if (!value) return 0
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? 0 : parsed
}

function parseDateParts(value: string): { year: string; month: string; day: string } | null {
  const trimmed = value.trim()
  if (!trimmed) return null

  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (isoMatch) {
    return { year: isoMatch[1], month: isoMatch[2], day: isoMatch[3] }
  }

  const usMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (usMatch) {
    return {
      year: usMatch[3],
      month: usMatch[1].padStart(2, '0'),
      day: usMatch[2].padStart(2, '0'),
    }
  }

  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return {
    year: String(parsed.getUTCFullYear()),
    month: String(parsed.getUTCMonth() + 1).padStart(2, '0'),
    day: String(parsed.getUTCDate()).padStart(2, '0'),
  }
}

function toIndexedClient(client: SimpleClient): IndexedClient {
  return {
    ...client,
    searchPhoneDigits: normalizePhoneDigits(client.phone),
    searchDobTokens: buildDobTokens(client.dob).join(' '),
  }
}

export function normalizePhoneDigits(value?: string | null): string {
  return (value ?? '').replace(/\D/g, '')
}

export function buildDobTokens(dob?: string | null): string[] {
  if (!dob) return []

  const trimmed = dob.trim()
  if (!trimmed) return []

  const tokens = new Set<string>()
  tokens.add(trimmed)

  const compactRaw = trimmed.replace(/\D/g, '')
  if (compactRaw.length >= 8) {
    tokens.add(compactRaw)
  }

  const parsed = parseDateParts(trimmed)
  if (!parsed) {
    return Array.from(tokens)
  }

  const { year, month, day } = parsed
  tokens.add(`${month}/${day}/${year}`)
  tokens.add(`${year}-${month}-${day}`)
  tokens.add(`${month}${day}${year}`)
  tokens.add(`${year}${month}${day}`)

  return Array.from(tokens)
}

export function getRecentClients(clients: SimpleClient[], limit: number = RECENT_CLIENT_LIMIT): SimpleClient[] {
  return [...clients]
    .sort((a, b) => toTimestamp(b.updatedAt) - toTimestamp(a.updatedAt))
    .slice(0, limit)
}

export function searchClients(
  clients: SimpleClient[] | undefined,
  query: string,
  limit: number = SEARCH_RESULT_LIMIT,
): SimpleClient[] {
  const safeClients = clients ?? []
  const trimmedQuery = query.trim()

  if (safeClients.length === 0) {
    return []
  }

  if (trimmedQuery.length < CLIENT_SEARCH_MIN_CHARS) {
    return getRecentClients(safeClients, RECENT_CLIENT_LIMIT)
  }

  const indexedClients = safeClients.map(toIndexedClient)
  const fuse = new Fuse(indexedClients, FUSE_OPTIONS)

  return fuse.search(trimmedQuery, { limit }).map((result) => result.item)
}
