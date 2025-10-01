import type { FieldAccess } from 'payload'

/**
 * Field-level access control for customer-specific fields
 * - Admins can always access
 * - Customers can only access their own records
 */
export const customerOnlyFieldAccess: FieldAccess = ({ req: { user }, doc }) => {
  if (!user) return false

  // Admins can access all fields
  if (user.collection === 'admins') {
    return true
  }

  // Customers can only access fields on their own records
  if (user.collection === 'clients' && doc) {
    return doc.customer === user.id
  }

  return false
}
