import type { Admin } from '@/payload-types'

export const checkRole = (roles: string | string[], user: unknown): boolean => {
  if (!user || typeof user !== 'object' || !('role' in user)) return false

  const userRole = (user as Admin).role
  if (!userRole) return false

  return Array.isArray(roles) ? roles.includes(userRole) : userRole === roles
}
