import type { Access } from 'payload'

/**
 * Admins-only access control for ecommerce collections
 * Used for operations that should only be performed by admin users
 */
export const adminOnly: Access = ({ req: { user } }) => {
  if (!user) return false

  // Only users from the admins collection can access
  return user.collection === 'admins'
}
