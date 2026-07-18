import Fuse from 'fuse.js'
import type { IFuseOptions } from 'fuse.js'
import { normalizeSearchEmail, normalizeSearchText } from './normalize'

export type SearchRankingClient = {
  id: string
  firstName: string
  middleInitial?: string | null
  lastName: string
  email: string
}

export type RankedClient<T extends SearchRankingClient> = {
  client: T
  score: number
}

type IndexedClient<T extends SearchRankingClient> = T & {
  searchFirstName: string
  searchLastName: string
  searchFullName: string
  searchEmail: string
}

const FUSE_OPTIONS: IFuseOptions<IndexedClient<SearchRankingClient>> = {
  threshold: 0.5,
  ignoreLocation: true,
  includeScore: true,
  minMatchCharLength: 2,
  keys: [
    { name: 'searchFirstName', weight: 0.3 },
    { name: 'searchLastName', weight: 0.3 },
    { name: 'searchFullName', weight: 0.25 },
    { name: 'searchEmail', weight: 0.15 },
  ],
}

function indexClient<T extends SearchRankingClient>(client: T): IndexedClient<T> {
  return {
    ...client,
    searchFirstName: normalizeSearchText(client.firstName),
    searchLastName: normalizeSearchText(client.lastName),
    searchFullName: normalizeSearchText(
      [client.firstName, client.middleInitial, client.lastName].filter(Boolean).join(' '),
    ),
    searchEmail: normalizeSearchEmail(client.email),
  }
}

function rankByEmail<T extends SearchRankingClient>(clients: T[], query: string, limit: number): RankedClient<T>[] {
  const indexed = clients.map(indexClient)
  const fuse = new Fuse(indexed, FUSE_OPTIONS as IFuseOptions<IndexedClient<T>>)

  return fuse.search(normalizeSearchEmail(query), { limit }).map(({ item, score }) => ({
    client: item,
    score: 1 - (score ?? 1),
  }))
}

function rankByName<T extends SearchRankingClient>(clients: T[], query: string, limit: number): RankedClient<T>[] {
  const normalizedTokens = normalizeSearchText(query).split(' ').filter(Boolean)
  const tokens =
    normalizedTokens.length > 2
      ? [normalizedTokens[0], normalizedTokens[normalizedTokens.length - 1]]
      : normalizedTokens
  if (tokens.length === 0) return []

  const indexed = clients.map(indexClient)
  const fuse = new Fuse(indexed, FUSE_OPTIONS as IFuseOptions<IndexedClient<T>>)
  let matchesById = new Map<string, { client: T; scores: number[] }>()

  tokens.forEach((token, tokenIndex) => {
    const tokenMatches = fuse.search(token)
    const tokenMatchesById = new Map(tokenMatches.map((match) => [match.item.id, match]))

    if (tokenIndex === 0) {
      matchesById = new Map(tokenMatches.map(({ item, score }) => [item.id, { client: item, scores: [score ?? 1] }]))
      return
    }

    for (const [id, match] of matchesById) {
      const tokenMatch = tokenMatchesById.get(id)
      if (!tokenMatch) {
        matchesById.delete(id)
      } else {
        match.scores.push(tokenMatch.score ?? 1)
      }
    }
  })

  return Array.from(matchesById.values())
    .filter((match) => match.scores.length === tokens.length)
    .map((match) => ({
      client: match.client,
      score: 1 - match.scores.reduce((total, score) => total + score, 0) / match.scores.length,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

export function rankClientCandidates<T extends SearchRankingClient>(
  clients: T[],
  query: string,
  options: { email?: boolean; limit: number },
): RankedClient<T>[] {
  return options.email ? rankByEmail(clients, query, options.limit) : rankByName(clients, query, options.limit)
}
