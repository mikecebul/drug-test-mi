import { beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getPayload: vi.fn(),
  ping: vi.fn(),
}))

vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', () => ({ getPayload: mocks.getPayload }))

import { GET } from './route'

describe('health API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.ping.mockResolvedValue({ ok: 1 })
    mocks.getPayload.mockResolvedValue({
      db: {
        connection: {
          db: {
            admin: () => ({ ping: mocks.ping }),
          },
        },
      },
    })
  })

  test('reports healthy only after MongoDB responds to a ping', async () => {
    const response = await GET()

    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(mocks.ping).toHaveBeenCalledWith({ maxTimeMS: 4_000 })
    await expect(response.json()).resolves.toMatchObject({
      status: 'ok',
      checks: { database: 'ok' },
    })
  })

  test('reports unavailable without leaking the database error', async () => {
    mocks.ping.mockRejectedValue(new Error('connection to private-database:27017 timed out'))

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body).toMatchObject({
      status: 'unavailable',
      checks: { database: 'unavailable' },
    })
    expect(JSON.stringify(body)).not.toContain('private-database')
  })
})
