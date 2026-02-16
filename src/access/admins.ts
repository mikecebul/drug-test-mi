import type { Access } from 'payload'

// Both admin and superAdmin can access
export const admins: Access = ({ req: { user } }) => {
  if (!user) return false

  return user.collection === 'admins'
}
