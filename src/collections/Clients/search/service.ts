import type { Payload, PayloadRequest, Where } from 'payload'
import type { Client } from '@/payload-types'
import {
  looksLikeDobSearch,
  looksLikePhoneSearch,
  normalizeSearchDob,
  normalizeSearchEmail,
  normalizeSearchPhone,
  normalizeSearchText,
} from './normalize'
import { rankClientCandidates } from './rank'
import type { ClientSearchInput, ClientSearchMatchReason, ClientSearchResponse, ClientSearchResult } from './types'

const DEFAULT_RESULT_LIMIT = 12
const MAX_RESULT_LIMIT = 25
const CANDIDATE_PAGE_SIZE = 250
const SCAN_PAGE_SIZE = 500

type SearchClient = Pick<
  Client,
  | 'id'
  | 'firstName'
  | 'middleInitial'
  | 'lastName'
  | 'email'
  | 'dob'
  | 'phone'
  | 'gender'
  | 'headshot'
  | 'updatedAt'
> & {
  searchFirstName?: string | null
  searchMiddleInitial?: string | null
  searchLastName?: string | null
  searchFullName?: string | null
  searchEmail?: string | null
  searchPhone?: string | null
  searchDob?: string | null
}

type SearchPayload = Pick<Payload, 'find'>
type SearchRequest = Pick<PayloadRequest, 'user'> & Partial<Pick<PayloadRequest, 'context'>>

const searchSelect = {
  id: true,
  firstName: true,
  middleInitial: true,
  lastName: true,
  email: true,
  dob: true,
  phone: true,
  gender: true,
  headshot: true,
  updatedAt: true,
  searchFirstName: true,
  searchMiddleInitial: true,
  searchLastName: true,
  searchFullName: true,
  searchEmail: true,
  searchPhone: true,
  searchDob: true,
} as const

function getLimit(value?: number) {
  if (!Number.isFinite(value)) return DEFAULT_RESULT_LIMIT
  return Math.max(1, Math.min(MAX_RESULT_LIMIT, Math.trunc(value as number)))
}

function getInputValues(input: ClientSearchInput) {
  const query = input.query?.trim() ?? ''
  const structuredName = input.name?.trim() ?? ''
  const email = normalizeSearchEmail(input.email || (query.includes('@') ? query : ''))
  const queryDob = looksLikeDobSearch(query) ? query : ''
  const dob = normalizeSearchDob(input.dob || queryDob)
  const phone = normalizeSearchPhone(input.phone || (!queryDob && looksLikePhoneSearch(query) ? query : ''))
  const name = normalizeSearchText(structuredName || (!email && !phone && !dob ? query : ''))

  return { query, name, email, phone, dob }
}

function buildExactNameWhere(name: string): Where | null {
  if (!name) return null
  const conditions: Where[] = [{ searchFullName: { equals: name } }]
  const nameParts = name.split(' ').filter(Boolean)

  if (nameParts.length === 1) {
    conditions.push({ searchFirstName: { equals: nameParts[0] } })
    conditions.push({ searchLastName: { equals: nameParts[0] } })
  } else {
    const first = nameParts[0]
    const last = nameParts[nameParts.length - 1]
    const middle = nameParts.length === 3 && nameParts[1].length === 1 ? nameParts[1] : null
    const middleCondition = middle ? [{ searchMiddleInitial: { equals: middle } }] : []

    if (nameParts.length === 2 || middle) {
      conditions.push({
        and: [{ searchFirstName: { equals: first } }, ...middleCondition, { searchLastName: { equals: last } }],
      })
      conditions.push({
        and: [{ searchFirstName: { equals: last } }, ...middleCondition, { searchLastName: { equals: first } }],
      })
    }
  }

  return { or: conditions }
}

function buildExactQueries(values: ReturnType<typeof getInputValues>): Where[] {
  const queries: Where[] = []

  if (values.email) queries.push({ searchEmail: { equals: values.email } })
  if (values.phone.length >= 10) queries.push({ searchPhone: { equals: values.phone } })
  if (values.dob) queries.push({ searchDob: { equals: values.dob } })

  if (values.name) {
    const nameWhere = buildExactNameWhere(values.name)
    if (nameWhere) queries.push(nameWhere)
  }

  return queries
}

function buildCandidateWhere(values: ReturnType<typeof getInputValues>): Where | null {
  const nameTokens = values.name.split(' ').filter((token) => token.length >= 2)
  if (nameTokens.length > 0) {
    const conditions: Where[] = []
    for (const token of nameTokens) {
      conditions.push({ searchFirstName: { contains: token } })
      conditions.push({ searchLastName: { contains: token } })
      conditions.push({ searchFullName: { contains: token } })
    }

    return { or: conditions }
  }

  if (values.email) return { searchEmail: { contains: values.email } }
  if (values.phone.length >= 4) return { searchPhone: { contains: values.phone } }
  if (values.dob) return { searchDob: { equals: values.dob } }
  return null
}

function getExactReason(
  client: SearchClient,
  values: ReturnType<typeof getInputValues>,
): ClientSearchMatchReason | null {
  if (values.email && normalizeSearchEmail(client.email) === values.email) return 'email'
  if (values.phone.length >= 10 && normalizeSearchPhone(client.phone) === values.phone) return 'phone'
  if (values.dob && normalizeSearchDob(client.dob) === values.dob) return 'date-of-birth'

  if (values.name) {
    const firstName = normalizeSearchText(client.firstName)
    const lastName = normalizeSearchText(client.lastName)
    const fullName = normalizeSearchText(
      [client.firstName, client.middleInitial, client.lastName].filter(Boolean).join(' '),
    )
    const parts = values.name.split(' ').filter(Boolean)
    const first = parts[0]
    const last = parts[parts.length - 1]

    if (
      fullName === values.name ||
      (parts.length === 1 && (firstName === first || lastName === first)) ||
      (parts.length === 2 && ((firstName === first && lastName === last) || (firstName === last && lastName === first)))
    ) {
      return 'name'
    }
  }

  return null
}

function getPossibleReason(values: ReturnType<typeof getInputValues>): ClientSearchMatchReason {
  if (values.name) return 'name'
  if (values.email) return 'email'
  if (values.phone) return 'phone'
  if (values.dob) return 'date-of-birth'
  return 'name'
}

function getHeadshot(client: SearchClient) {
  if (!client.headshot || typeof client.headshot !== 'object') return {}

  return {
    headshot: client.headshot.thumbnailURL || client.headshot.url || undefined,
    headshotId: client.headshot.id,
  }
}

function toResult(
  client: SearchClient,
  matchType: ClientSearchResult['matchType'],
  matchReason: ClientSearchMatchReason,
  score?: number,
): ClientSearchResult {
  const fullName = [client.firstName, client.middleInitial, client.lastName].filter(Boolean).join(' ')

  return {
    id: client.id,
    firstName: client.firstName,
    middleInitial: client.middleInitial || undefined,
    lastName: client.lastName,
    fullName,
    initials: `${client.firstName.charAt(0)}${client.lastName.charAt(0)}`.toUpperCase(),
    email: client.email,
    dob: client.dob || undefined,
    phone: client.phone || undefined,
    gender: client.gender || undefined,
    updatedAt: client.updatedAt || undefined,
    ...getHeadshot(client),
    matchType,
    matchReason,
    ...(typeof score === 'number' ? { score } : {}),
  }
}

async function findClients(
  payload: SearchPayload,
  req: SearchRequest,
  options: { where?: Where; limit: number; page?: number; sort?: string },
) {
  const result = await payload.find({
    collection: 'clients',
    depth: 1,
    where: options.where,
    limit: options.limit,
    page: options.page,
    sort: options.sort,
    select: searchSelect,
    user: req.user || undefined,
    overrideAccess: false,
  })

  return result as unknown as {
    docs: SearchClient[]
    hasNextPage: boolean
    nextPage?: number | null
  }
}

async function loadAllClients(payload: SearchPayload, req: SearchRequest): Promise<SearchClient[]> {
  const clients: SearchClient[] = []
  let page = 1

  while (true) {
    const result = await findClients(payload, req, { limit: SCAN_PAGE_SIZE, page, sort: 'id' })
    clients.push(...result.docs)
    if (!result.hasNextPage) break
    page = result.nextPage || page + 1
  }

  return clients
}

async function loadCandidateClients(payload: SearchPayload, req: SearchRequest, where: Where): Promise<SearchClient[]> {
  const clients: SearchClient[] = []
  let page = 1

  while (true) {
    const result = await findClients(payload, req, {
      where,
      limit: CANDIDATE_PAGE_SIZE,
      page,
      sort: 'lastName',
    })
    clients.push(...result.docs)
    if (!result.hasNextPage) break
    page = result.nextPage || page + 1
  }

  return clients
}

function dedupeClients(clients: SearchClient[]) {
  return Array.from(new Map(clients.map((client) => [client.id, client])).values())
}

export async function searchClientsForAdmin(options: {
  payload: SearchPayload
  req: SearchRequest
  input: ClientSearchInput
}): Promise<ClientSearchResponse> {
  const { payload, req, input } = options
  const limit = getLimit(input.limit)

  if (!req.user || req.user.collection !== 'admins') {
    throw new Error('Unauthorized - admin access required.')
  }

  if (input.recent) {
    const recent = await findClients(payload, req, { limit, sort: '-updatedAt' })
    return {
      exactMatches: [],
      possibleMatches: recent.docs.map((client) => toResult(client, 'partial', 'recent')),
    }
  }

  const values = getInputValues(input)
  if (!values.query && !values.name && !values.email && !values.phone && !values.dob) {
    return { exactMatches: [], possibleMatches: [] }
  }

  for (const exactWhere of buildExactQueries(values)) {
    const exactResult = await findClients(payload, req, {
      where: exactWhere,
      limit: MAX_RESULT_LIMIT,
      sort: 'lastName',
    })
    const exactMatches = exactResult.docs
      .map((client) => ({ client, reason: getExactReason(client, values) }))
      .filter((match): match is { client: SearchClient; reason: ClientSearchMatchReason } => Boolean(match.reason))
      .map(({ client, reason }) => toResult(client, 'exact', reason))
      .slice(0, limit)

    if (exactMatches.length > 0) return { exactMatches, possibleMatches: [] }
  }

  const candidateWhere = buildCandidateWhere(values)
  const candidateClients = candidateWhere ? await loadCandidateClients(payload, req, candidateWhere) : []
  const fallbackClients =
    candidateClients.length > 0 ? dedupeClients(candidateClients) : await loadAllClients(payload, req)
  const fallbackExactMatches = fallbackClients
    .map((client) => ({ client, reason: getExactReason(client, values) }))
    .filter((match): match is { client: SearchClient; reason: ClientSearchMatchReason } => Boolean(match.reason))
    .map(({ client, reason }) => toResult(client, 'exact', reason))
    .slice(0, limit)

  if (fallbackExactMatches.length > 0) {
    return { exactMatches: fallbackExactMatches, possibleMatches: [] }
  }

  if (values.phone || values.dob) {
    const deterministicMatches = fallbackClients.filter((client) => {
      if (values.phone) return normalizeSearchPhone(client.phone).includes(values.phone)
      return Boolean(values.dob && normalizeSearchDob(client.dob) === values.dob)
    })

    return {
      exactMatches: [],
      possibleMatches: deterministicMatches
        .slice(0, limit)
        .map((client) => toResult(client, 'partial', getPossibleReason(values))),
    }
  }

  const fuzzyQuery = values.name || values.email
  const ranked = rankClientCandidates(fallbackClients, fuzzyQuery, {
    email: Boolean(values.email && !values.name),
    limit,
  })
  const matchType = candidateClients.length > 0 ? 'partial' : 'fuzzy'

  return {
    exactMatches: [],
    possibleMatches: ranked.map(({ client, score }) => toResult(client, matchType, getPossibleReason(values), score)),
  }
}
