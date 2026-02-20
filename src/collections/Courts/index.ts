import type { CollectionConfig } from 'payload'
import { admins } from '@/access/admins'
import { anyone } from '@/access/anyone'
import { superAdmin } from '@/access/superAdmin'

export const Courts: CollectionConfig = {
  slug: 'courts',
  labels: {
    singular: 'Court',
    plural: 'Courts',
  },
  access: {
    create: admins,
    delete: superAdmin,
    read: anyone,
    update: admins,
  },
  admin: {
    group: 'Referrals',
    useAsTitle: 'name',
    defaultColumns: ['name', 'preferredTestType', 'isActive'],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      unique: true,
      index: true,
    },
    {
      name: 'contacts',
      type: 'array',
      minRows: 1,
      fields: [
        {
          name: 'name',
          type: 'text',
        },
        {
          name: 'email',
          type: 'email',
          required: true,
        },
      ],
      admin: {
        description:
          'Recipient contacts. The first row is treated as the main contact for display purposes.',
      },
    },
    {
      name: 'preferredTestType',
      type: 'relationship',
      relationTo: 'test-types',
      filterOptions: {
        isActive: {
          equals: true,
        },
      },
    },
    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description:
          'Inactive courts are hidden from quick-select dropdowns, but remain usable for linked clients and email delivery.',
      },
    },
    {
      name: 'clients',
      type: 'join',
      collection: 'clients',
      on: 'referral',
    },
  ],
}
