import type { CollectionConfig } from 'payload'

import { authenticated } from '../../access/authenticated'
import { roleSelectMutate } from './access/roleSelectMutate'
import { ensureFirstUserIsSuperAdmin } from './hooks/ensureFirstUserIsSuperAdmin'
import { revalidatePath } from 'next/cache'
import { superAdmin } from '@/access/superAdmin'
import { adminOrSelf } from '@/access/adminOrSelf'
import { anyone } from '@/access/anyone'
import { checkRole } from '@/access/checkRole'

const Admins: CollectionConfig = {
  slug: 'admins',
  labels: {
    singular: 'Admin',
    plural: 'Admins',
  },
  access: {
    read: adminOrSelf,
    create: anyone,
    update: adminOrSelf,
    delete: superAdmin,
    unlock: superAdmin,
    admin: ({ req: { user } }) => checkRole(['admin', 'superAdmin'], user),
  },
  admin: {
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
      defaultValue: 'admin',
      required: true,
      access: {
        create: roleSelectMutate,
        read: authenticated,
        update: roleSelectMutate,
      },
      options: [
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
            path: '@/collections/Admins/RoleSelect.client',
            exportName: 'RoleSelectClient',
          },
          Cell: '@/collections/Admins/RoleCell',
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
            collection: 'asmins',
            limit: 0,
          })
          if (users.totalDocs === 0) return true
        }

        if (user?.role !== 'superAdmin' && val === 'superAdmin')
          return 'Admins cannot create super admins'
        return true
      },
    },
  ],
  timestamps: true,
}

export default Admins
