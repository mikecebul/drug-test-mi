import { afterEach, describe, expect, it, vi } from 'vitest'

import { POST } from './route'

describe('development Playwright runner', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('is unavailable in production', async () => {
    vi.stubEnv('NODE_ENV', 'production')

    const response = await POST(
      new Request('https://example.test/api/dev/run-playwright', {
        method: 'POST',
        body: JSON.stringify({ suite: 'smoke' }),
        headers: { 'content-type': 'application/json' },
      }),
    )

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Not found' })
  })
})
