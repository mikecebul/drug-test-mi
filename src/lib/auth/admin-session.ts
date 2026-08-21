import type { Admin } from '@/payload-types'

export const ADMIN_SESSION_DURATION_SECONDS = 48 * 60 * 60

export class AdminSessionExpiredError extends Error {
  constructor() {
    super('Your session has expired. Please log in again.')
    this.name = 'AdminSessionExpiredError'
  }
}

export type RefreshedAdminSession = {
  exp?: number
  refreshedToken?: string
  token?: string
  user: Admin
}

async function readAdminSession(response: Response): Promise<RefreshedAdminSession | null> {
  if (!response.ok) return null

  const result = (await response.json()) as Partial<RefreshedAdminSession>
  if (!result.user || result.user.collection !== 'admins') return null

  return result as RefreshedAdminSession
}

export async function refreshAdminSession(request: typeof fetch = fetch): Promise<RefreshedAdminSession> {
  const response = await request('/api/admins/refresh-token', {
    credentials: 'include',
    method: 'POST',
  })

  const refreshedSession = await readAdminSession(response)
  if (refreshedSession && typeof refreshedSession.exp === 'number') {
    return refreshedSession
  }

  // Payload auto-login and custom auth strategies can produce an authenticated
  // user without a refreshable database session. Verify those strategies with
  // the same endpoint Payload uses when the admin UI loads.
  const meResponse = await request('/api/admins/me', {
    credentials: 'include',
  })
  const currentSession = await readAdminSession(meResponse)
  if (currentSession) return currentSession

  if (
    response.status === 401 ||
    response.status === 403 ||
    meResponse.status === 401 ||
    meResponse.status === 403 ||
    meResponse.ok
  ) {
    throw new AdminSessionExpiredError()
  }

  throw new Error('Unable to verify your session. Check the connection and try again.')
}
