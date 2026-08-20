import { describe, expect, test, vi } from 'vitest'

import { ADMIN_SESSION_DURATION_SECONDS, AdminSessionExpiredError, refreshAdminSession } from './admin-session'

describe('admin session configuration', () => {
  test('uses a 48-hour session duration', () => {
    expect(ADMIN_SESSION_DURATION_SECONDS).toBe(172_800)
  })
})

describe('refreshAdminSession', () => {
  test('refreshes and returns an authenticated admin session', async () => {
    const session = {
      exp: 1_800_000_000,
      refreshedToken: 'refreshed-token',
      user: {
        id: 'admin-1',
        collection: 'admins' as const,
        createdAt: '2026-08-20T00:00:00.000Z',
        updatedAt: '2026-08-20T00:00:00.000Z',
        email: 'admin@example.com',
      },
    }
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(session), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      }),
    )

    await expect(refreshAdminSession(request)).resolves.toEqual(session)
    expect(request).toHaveBeenCalledWith('/api/admins/refresh-token', {
      credentials: 'include',
      method: 'POST',
    })
  })

  test('identifies an expired session', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 403 }))

    await expect(refreshAdminSession(request)).rejects.toBeInstanceOf(AdminSessionExpiredError)
  })

  test('blocks navigation when session verification is unavailable', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 503 }))

    await expect(refreshAdminSession(request)).rejects.toThrow(
      'Unable to verify your session. Check the connection and try again.',
    )
  })
})
