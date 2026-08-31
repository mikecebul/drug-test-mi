import { beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getPayload: vi.fn(),
  command: vi.fn(),
  loggerError: vi.fn(),
  loggerInfo: vi.fn(),
}))

vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', () => ({ getPayload: mocks.getPayload }))

import { GET } from './route'
import { GET as GET_READY } from './ready/route'

describe('health API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.command.mockResolvedValue({ ok: 1 })
    mocks.getPayload.mockResolvedValue({
      db: {
        connection: {
          db: {
            command: mocks.command,
          },
        },
      },
      logger: {
        error: mocks.loggerError,
        info: mocks.loggerInfo,
      },
    })
  })

  test('reports healthy only after MongoDB responds to a ping', async () => {
    const response = await GET()

    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(mocks.command).toHaveBeenCalledWith(
      { maxTimeMS: 3_000, ping: 1 },
      {
        signal: expect.any(AbortSignal),
        timeoutMS: 3_000,
      },
    )
    await expect(response.json()).resolves.toMatchObject({
      status: 'ok',
      checks: { application: 'ok', payload: 'ok', database: 'ok' },
    })
  })

  test('reports unavailable without leaking the database error', async () => {
    mocks.command.mockRejectedValue(new Error('connection to private-database:27017 timed out'))

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body).toMatchObject({
      status: 'unavailable',
      checks: { application: 'ok', payload: 'ok', database: 'unavailable' },
    })
    expect(JSON.stringify(body)).not.toContain('private-database')
  })

  test('exposes the same database-backed check at the explicit readiness endpoint', async () => {
    const response = await GET_READY()

    expect(response.status).toBe(200)
    expect(mocks.getPayload).toHaveBeenCalledOnce()
    expect(mocks.command).toHaveBeenCalledOnce()
  })

  test('distinguishes Payload initialization failures from MongoDB ping failures', async () => {
    mocks.getPayload.mockRejectedValue(new Error('Payload failed to initialize'))

    const response = await GET_READY()

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toMatchObject({
      status: 'unavailable',
      checks: { application: 'ok', payload: 'unavailable', database: 'unknown' },
    })
    expect(mocks.command).not.toHaveBeenCalled()
  })

  test('returns within the readiness deadline when Payload initialization hangs', async () => {
    vi.useFakeTimers()
    mocks.getPayload.mockReturnValue(new Promise(() => undefined))

    try {
      const responsePromise = GET_READY()
      await vi.advanceTimersByTimeAsync(4_000)
      const response = await responsePromise

      expect(response.status).toBe(503)
      expect(mocks.command).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })
})
