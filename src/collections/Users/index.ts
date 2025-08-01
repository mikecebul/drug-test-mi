import type { CollectionConfig } from 'payload'

import { authenticated } from '../../access/authenticated'
import { roleSelectMutate } from './access/roleSelectMutate'
import { ensureFirstUserIsSuperAdmin } from './hooks/ensureFirstUserIsSuperAdmin'
import { revalidatePath } from 'next/cache'
import { superAdmin } from '@/access/superAdmin'
import { self } from '@/access/self'
import { adminUserAccess } from './access/adminUserAccess'

const Users: CollectionConfig = {
  slug: 'users',
  access: {
    admin: authenticated,
    create: ({ req }) => adminUserAccess({ req }) || superAdmin({ req }),
    delete: ({ req }) => adminUserAccess({ req }) || superAdmin({ req }),
    read: authenticated,
    update: ({ req, id }) => self({ req, id }) || adminUserAccess({ req }) || superAdmin({ req }),
  },
  admin: {
    hideAPIURL: true,
    defaultColumns: ['name', 'email', 'role'],
    group: 'Admin',
    useAsTitle: 'name',
  },
  auth: {},
  fields: [
    {
      name: 'name',
      type: 'text',
    },
    {
      name: 'role',
      type: 'select',
      defaultValue: 'editor',
      required: true,
      access: {
        create: roleSelectMutate,
        read: authenticated,
        update: roleSelectMutate,
      },
      options: [
        {
          label: 'User',
          value: 'user',
        },
        {
          label: 'Editor',
          value: 'editor',
        },
        {
          label: 'Admin',
          value: 'admin',
        },
        {
          label: 'Super Admin',
          value: 'superAdmin',
        },
      ],
      admin: {
        components: {
          Field: {
            path: '@/collections/Users/RoleSelect.client',
            exportName: 'RoleSelectClient',
          },
          Cell: '@/collections/Users/RoleCell',
        },
        condition: (data, siblingData, { user }) => {
          if (!user) return false
          return true
        },
      },
      hooks: {
        beforeChange: [ensureFirstUserIsSuperAdmin],
        afterChange: [
          ({ req }) =>
            req.headers['X-Payload-Migration'] !== 'true' && revalidatePath('/(payload)', 'layout'),
        ],
      },
      validate: async (val, { req: { user, payload } }) => {
        if (!user) {
          const users = await payload.find({
            collection: 'users',
            limit: 0,
          })
          if (users.totalDocs === 0) return true
        }

        if (user?.role !== 'superAdmin' && val === 'superAdmin')
          return 'Admins cannot create super admins'
        if (user?.role === 'editor') return 'Editors cannot update roles'
        return true
      },
    },
  ],
  timestamps: true,
}

export default Users
