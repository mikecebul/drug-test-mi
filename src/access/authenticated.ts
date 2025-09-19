import type { AccessArgs } from 'payload'

import type { Admin, Client } from '@/payload-types'

type isAuthenticated = (args: AccessArgs<Admin | Client>) => boolean | Promise<boolean>

export const authenticated: isAuthenticated = ({ req: { user } }) => {
  return Boolean(user)
}
