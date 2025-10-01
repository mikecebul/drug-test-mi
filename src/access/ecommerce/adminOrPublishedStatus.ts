import type { Access } from 'payload'

/**
 * Access control for published resources
 * - Admins can access all records (published and draft)
 * - Customers can only access published records
 */
export const adminOrPublishedStatus: Access = ({ req: { user } }) => {
  // Admins can access everything
  if (user?.collection === 'admins') {
    return true
  }

  // Non-admins can only access published items
  return {
    _status: {
      equals: 'published',
    },
  }
}
