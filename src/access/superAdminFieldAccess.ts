import type { FieldAccess } from 'payload'

/**
 * Field-level access control: SuperAdmins can edit, all admins can read
 */
export const superAdminFieldAccess: {
  read: FieldAccess
  update: FieldAccess
} = {
  read: ({ req }) => {
    // All admins can read
    return req.user?.collection === 'admins'
  },
  update: ({ req }) => {
    // Only superAdmins can update
    return req.user?.collection === 'admins' && req.user?.role === 'superAdmin'
  },
}
