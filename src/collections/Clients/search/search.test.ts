import { describe, expect, test, vi } from 'vitest'
import { adminClientSearchEndpoint } from './endpoint'
import { buildClientSearchFields, normalizeSearchDob, normalizeSearchPhone, normalizeSearchText } from './normalize'
import { rankClientCandidates } from './rank'
import { searchClientsForAdmin } from './service'

type SearchClient = {
  id: string
  firstName: string
  middleInitial: string | null
  lastName: string
  email: string
  dob: string | null
  phone: string | null
  headshot: null
  updatedAt: string
}

const adminUser = {
  id: 'admin-1',
  collection: 'admins' as const,
  email: 'admin@example.com',
}

function createClient(id: string, overrides: Partial<SearchClient> = {}): SearchClient {
  return {
    id,
    firstName: 'Jane',
    middleInitial: null,
    lastName: 'Carter',
    email: `jane.${id}@example.com`,
    dob: '1988-11-30T00:00:00.000Z',
    phone: '(616) 222-9999',
    headshot: null,
    updatedAt: '2026-07-18T12:00:00.000Z',
    ...overrides,
  }
}

function page(docs: SearchClient[], hasNextPage = false, nextPage: number | null = null) {
  return { docs, hasNextPage, nextPage }
}

function createSearchPayload(...responses: Array<ReturnType<typeof page>>) {
  return {
    find: vi.fn().mockImplementation(() => Promise.resolve(responses.shift() || page([]))),
  }
}

describe('client search normalization', () => {
  test('normalizes names, US phone numbers, and supported DOB formats consistently', () => {
    expect(normalizeSearchText("  José  O'Neil-Smith ")).toBe('jose o neil smith')
    expect(normalizeSearchPhone('+1 (616) 222-9999')).toBe('6162229999')
    expect(normalizeSearchDob('11/30/1988')).toBe('1988-11-30')
    expect(normalizeSearchDob('11301988')).toBe('1988-11-30')

    expect(
      buildClientSearchFields({
        firstName: 'Jane',
        middleInitial: 'Q',
        lastName: 'Carter',
        email: ' JANE@example.com ',
        phone: '+1 (616) 222-9999',
        dob: '11/30/1988',
      }),
    ).toEqual({
      searchFirstName: 'jane',
      searchMiddleInitial: 'q',
      searchLastName: 'carter',
      searchFullName: 'jane q carter',
      searchEmail: 'jane@example.com',
      searchPhone: '6162229999',
      searchDob: '1988-11-30',
    })
  })
})

describe('Fuse fallback ranking', () => {
  test('finds misspelled and last-name-first searches without treating them as exact identity matches', () => {
    const jane = createClient('jane')
    const other = createClient('other', { firstName: 'Alex', lastName: 'Wilson' })

    const results = rankClientCandidates([other, jane], 'Carter Jnae', { limit: 5 })

    expect(results[0]?.client.id).toBe('jane')
    expect(results[0]?.score).toBeGreaterThan(0.6)
  })
})

describe('protected server-side client search', () => {
  test('returns every duplicate exact-name match and does not choose one automatically', async () => {
    const firstJane = createClient('jane-1')
    const secondJane = createClient('jane-2', { email: 'other.jane@example.com' })
    const payload = createSearchPayload(page([firstJane, secondJane]))

    const result = await searchClientsForAdmin({
      payload: payload as never,
      req: { user: adminUser } as never,
      input: { query: 'Jane Carter' },
    })

    expect(result.exactMatches.map((client) => client.id)).toEqual(['jane-1', 'jane-2'])
    expect(result.exactMatches.every((client) => client.matchReason === 'name')).toBe(true)
    expect(result.possibleMatches).toEqual([])
    expect(payload.find).toHaveBeenCalledTimes(1)
    expect(payload.find).toHaveBeenCalledWith(
      expect.objectContaining({
        overrideAccess: false,
        user: adminUser,
      }),
    )
  })

  test('prioritizes an exact booking email over name possibilities', async () => {
    const client = createClient('registered-after-booking', { email: 'new.client@example.com' })
    const payload = createSearchPayload(page([client]))

    const result = await searchClientsForAdmin({
      payload: payload as never,
      req: { user: adminUser } as never,
      input: {
        name: 'Different Booking Name',
        email: 'NEW.CLIENT@example.com',
        phone: '616-555-1111',
      },
    })

    expect(result.exactMatches).toHaveLength(1)
    expect(result.exactMatches[0]).toMatchObject({
      id: 'registered-after-booking',
      matchType: 'exact',
      matchReason: 'email',
    })
    expect(result.possibleMatches).toEqual([])
  })

  test('still classifies exact identity correctly while normalized fields are being backfilled', async () => {
    const client = createClient('legacy', { email: 'legacy.client@example.com' })
    const payload = createSearchPayload(page([]), page([]), page([client]))

    const result = await searchClientsForAdmin({
      payload: payload as never,
      req: { user: adminUser } as never,
      input: { query: 'legacy.client@example.com' },
    })

    expect(result.exactMatches).toEqual([
      expect.objectContaining({ id: 'legacy', matchType: 'exact', matchReason: 'email' }),
    ])
    expect(result.possibleMatches).toEqual([])
  })

  test('does not label a different middle initial as an exact name match', async () => {
    const client = createClient('middle', { middleInitial: 'Q' })
    const payload = createSearchPayload(page([client]), page([client]))

    const result = await searchClientsForAdmin({
      payload: payload as never,
      req: { user: adminUser } as never,
      input: { query: 'Jane X Carter' },
    })

    expect(result.exactMatches).toEqual([])
    expect(result.possibleMatches).toEqual([
      expect.objectContaining({ id: 'middle', matchType: 'partial', matchReason: 'name' }),
    ])
  })

  test('keeps partial phone results deterministic and never sends them through Fuse', async () => {
    const client = createClient('phone', { phone: '(616) 222-9999' })
    const payload = createSearchPayload(page([client]))

    const result = await searchClientsForAdmin({
      payload: payload as never,
      req: { user: adminUser } as never,
      input: { query: '2229999' },
    })

    expect(result.exactMatches).toEqual([])
    expect(result.possibleMatches).toEqual([
      expect.objectContaining({ id: 'phone', matchType: 'partial', matchReason: 'phone' }),
    ])
    expect(payload.find).toHaveBeenCalledTimes(1)
  })

  test('paginates past 1,000 clients when a typo requires the Fuse fallback', async () => {
    const firstPage = Array.from({ length: 500 }, (_, index) =>
      createClient(`first-${index}`, { firstName: 'Other', lastName: `Person${index}` }),
    )
    const secondPage = Array.from({ length: 500 }, (_, index) =>
      createClient(`second-${index}`, { firstName: 'Another', lastName: `Client${index}` }),
    )
    const beyondOneThousand = createClient('beyond-1000', {
      firstName: 'Zachary',
      lastName: 'Beyond',
      email: 'zachary.beyond@example.com',
    })
    const payload = createSearchPayload(
      page([]),
      page([]),
      page(firstPage, true, 2),
      page(secondPage, true, 3),
      page([beyondOneThousand]),
    )

    const result = await searchClientsForAdmin({
      payload: payload as never,
      req: { user: adminUser } as never,
      input: { query: 'Zachry Beynd' },
    })

    expect(result.possibleMatches[0]).toMatchObject({
      id: 'beyond-1000',
      matchType: 'fuzzy',
      matchReason: 'name',
    })
    expect(payload.find).toHaveBeenCalledTimes(5)
    expect(payload.find.mock.calls.at(-1)?.[0]).toEqual(expect.objectContaining({ page: 3, limit: 500 }))
  })

  test('rejects non-admin callers before querying client data', async () => {
    const payload = createSearchPayload()

    await expect(
      searchClientsForAdmin({
        payload: payload as never,
        req: { user: { id: 'client-1', collection: 'clients' } } as never,
        input: { query: 'Jane' },
      }),
    ).rejects.toThrow('Unauthorized')
    expect(payload.find).not.toHaveBeenCalled()
  })
})

describe('client search endpoint authorization', () => {
  const handler = adminClientSearchEndpoint.handler

  test('returns 401 without a signed-in user', async () => {
    const response = await handler({
      user: null,
      url: 'http://localhost/api/clients/admin-search?q=Jane',
    } as never)

    expect(response.status).toBe(401)
  })

  test('returns 403 to authenticated clients', async () => {
    const response = await handler({
      user: { id: 'client-1', collection: 'clients' },
      url: 'http://localhost/api/clients/admin-search?q=Jane',
    } as never)

    expect(response.status).toBe(403)
  })
})
