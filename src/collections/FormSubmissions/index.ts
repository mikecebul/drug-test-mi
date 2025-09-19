import type { CollectionConfig } from 'payload'
import { sendEmail } from './sendEmail'
import { admins } from '@/access/admins'
import { superAdmin } from '@/access/superAdmin'

export const FormSubmissions: CollectionConfig = {
  slug: 'form-submissions',
  access: {
    read: admins,
    create: () => true,
    delete: superAdmin,
    update: superAdmin,
  },
  admin: {
    group: 'Forms',
  },
  fields: [
    {
      name: 'form',
      type: 'relationship',
      admin: {
        readOnly: true,
      },
      relationTo: 'forms',
      required: true,
    },
    {
      name: 'data',
      type: 'json',
      required: true,
    },
  ],
  hooks: {
    afterChange: [(data) => sendEmail(data)],
  },
}
