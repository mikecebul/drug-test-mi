import { describe, expect, test, vi } from 'vitest'

vi.mock('payload', () => ({
  getPayload: vi.fn(() => {
    throw new Error('Liveness checks must not initialize Payload')
  }),
}))

import { GET } from './route'

describe('liveness API', () => {
  test('reports that the Next.js process can serve requests without checking MongoDB', async () => {
    const response = await GET()

    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    await expect(response.json()).resolves.toMatchObject({
      status: 'ok',
      checks: { application: 'ok' },
    })
  })
})
