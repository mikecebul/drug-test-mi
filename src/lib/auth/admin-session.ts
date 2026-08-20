import type { Admin } from '@/payload-types'

export const ADMIN_SESSION_DURATION_SECONDS = 48 * 60 * 60

export class AdminSessionExpiredError extends Error {
  constructor() {
    super('Your session has expired. Please log in again.')
    this.name = 'AdminSessionExpiredError'
  }
}

export type RefreshedAdminSession = {
  exp: number
  refreshedToken?: string
  token?: string
  user: Admin
}

export async function refreshAdminSession(request: typeof fetch = fetch): Promise<RefreshedAdminSession> {
  const response = await request('/api/admins/refresh-token', {
    credentials: 'include',
    method: 'POST',
  })

  if (response.status === 401 || response.status === 403) {
    throw new AdminSessionExpiredError()
  }

  if (!response.ok) {
    throw new Error('Unable to verify your session. Check the connection and try again.')
  }

  const result = (await response.json()) as Partial<RefreshedAdminSession>

  if (!result.user || result.user.collection !== 'admins' || typeof result.exp !== 'number') {
    throw new AdminSessionExpiredError()
  }

  return result as RefreshedAdminSession
}
