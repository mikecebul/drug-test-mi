import type { Access } from 'payload'

// Admins can access all records, users can only access their own
export const adminOrSelf: Access = ({ req: { user } }) => {
  if (!user) return false

  if (user.collection !== 'admins') return false

  if (user.role === 'superAdmin') return true

  // Users can only access their own record
  return {
    id: {
      equals: user.id,
    },
  }
}