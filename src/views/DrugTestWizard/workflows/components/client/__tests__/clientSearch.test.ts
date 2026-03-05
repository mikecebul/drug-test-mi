import { describe, expect, test } from 'vitest'
import type { SimpleClient } from '../getClients'
import { getRecentClients, searchClients } from '../clientSearch'

function createClient(overrides: Partial<SimpleClient> = {}): SimpleClient {
  return {
    id: 'client-1',
    firstName: 'John',
    lastName: 'Smith',
    fullName: 'John Smith',
    initials: 'JS',
    email: 'john.smith@example.com',
    dob: '1990-01-02',
    phone: '(231) 555-1234',
    updatedAt: '2026-02-15T12:00:00.000Z',
    ...overrides,
  }
}

describe('searchClients', () => {
  const clients: SimpleClient[] = [
    createClient(),
    createClient({
      id: 'client-2',
      firstName: 'Jane',
      lastName: 'Carter',
      fullName: 'Jane Carter',
      initials: 'JC',
      email: 'jane.carter@example.com',
      dob: '1988-11-30',
      phone: '(616) 222-9999',
      updatedAt: '2026-02-14T12:00:00.000Z',
    }),
    createClient({
      id: 'client-3',
      firstName: 'Avery',
      lastName: 'Wilson',
      fullName: 'Avery Wilson',
      initials: 'AW',
      email: 'avery.w@example.com',
      dob: '1999-05-19',
      phone: '(313) 100-1000',
      updatedAt: '2026-02-13T12:00:00.000Z',
    }),
  ]

  test('returns first-name partial matches', () => {
    const results = searchClients(clients, 'jo')
    expect(results[0]?.id).toBe('client-1')
  })

  test('returns last-name partial matches', () => {
    const results = searchClients(clients, 'cart')
    expect(results.some((client) => client.id === 'client-2')).toBe(true)
  })

  test('returns email partial matches', () => {
    const results = searchClients(clients, 'jane.carter@')
    expect(results[0]?.id).toBe('client-2')
  })

  test('returns phone matches for formatted and compact query', () => {
    const formattedResults = searchClients(clients, '(231) 555')
    const compactResults = searchClients(clients, '2315551234')

    expect(formattedResults.some((client) => client.id === 'client-1')).toBe(true)
    expect(compactResults.some((client) => client.id === 'client-1')).toBe(true)
  })

  test('returns DOB matches across supported formats', () => {
    const slashResults = searchClients(clients, '01/02/1990')
    const compactResults = searchClients(clients, '01021990')
    const isoResults = searchClients(clients, '1990-01-02')

    expect(slashResults.some((client) => client.id === 'client-1')).toBe(true)
    expect(compactResults.some((client) => client.id === 'client-1')).toBe(true)
    expect(isoResults.some((client) => client.id === 'client-1')).toBe(true)
  })

  test('query shorter than 2 chars returns top recent clients and caps at 25', () => {
    const manyClients = Array.from({ length: 30 }, (_, index) =>
      createClient({
        id: `recent-${index}`,
        firstName: `First${index}`,
        lastName: `Last${index}`,
        fullName: `First${index} Last${index}`,
        initials: `F${index}`,
        email: `recent-${index}@example.com`,
        updatedAt: new Date(Date.UTC(2026, 1, 15 - index, 12, 0, 0)).toISOString(),
      }),
    )

    const results = searchClients(manyClients, 'j')

    expect(results).toHaveLength(25)
    expect(results[0]?.id).toBe('recent-0')
    expect(results[1]?.id).toBe('recent-1')
  })

  test('handles missing phone, dob, and updatedAt without crashing', () => {
    const sparseClients: SimpleClient[] = [
      createClient({
        id: 'sparse-1',
        firstName: 'Alpha',
        lastName: 'One',
        fullName: 'Alpha One',
        initials: 'AO',
        email: 'alpha@example.com',
        dob: undefined,
        phone: undefined,
        updatedAt: undefined,
      }),
      createClient({
        id: 'sparse-2',
        firstName: 'Bravo',
        lastName: 'Two',
        fullName: 'Bravo Two',
        initials: 'BT',
        email: 'bravo@example.com',
        updatedAt: '2026-02-10T12:00:00.000Z',
      }),
    ]

    expect(() => searchClients(sparseClients, 'al')).not.toThrow()
    expect(searchClients(sparseClients, 'al').some((client) => client.id === 'sparse-1')).toBe(true)

    const recent = getRecentClients(sparseClients, 2)
    expect(recent[0]?.id).toBe('sparse-2')
  })
})
