import type { Access } from 'payload'

/**
 * Access control for customer-owned resources
 * - Admins can access all records
 * - Customers (clients) can only access their own records
 */
export const adminOrCustomerOwner: Access = ({ req: { user } }) => {
  if (!user) return false

  // Admins can access all records
  if (user.collection === 'admins') {
    return true
  }

  // Customers can only access their own records
  if (user.collection === 'clients') {
    return {
      customer: {
        equals: user.id,
      },
    }
  }

  return false
}
