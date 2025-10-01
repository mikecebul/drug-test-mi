import type { FieldAccess } from 'payload'

/**
 * Field-level access control that only allows admins
 * Used for sensitive fields that customers should not be able to read or modify
 */
export const adminOnlyFieldAccess: FieldAccess = ({ req: { user } }) => {
  if (!user) return false

  // Only users from the admins collection can access
  return user.collection === 'admins'
}
