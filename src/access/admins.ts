import type { Access } from 'payload'
import { checkRole } from './checkRole'

// Both admin and superAdmin can access
export const admins: Access = ({ req: { user } }) => {
  if (!user) return false

  return user.collection === 'admins'
}
