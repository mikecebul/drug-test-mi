import type { CollectionConfig } from 'payload'
import { admins } from '@/access/admins'
import { superAdmin } from '@/access/superAdmin'
import { revalidateTechnicians } from './hooks/revalidateTechnicians'
import { anyone } from '@/access/anyone'

export const Technicians: CollectionConfig = {
  slug: 'technicians',
  access: {
    create: admins,
    delete: superAdmin,
    read: anyone,
    update: admins,
  },
  admin: {
    defaultColumns: ['name', 'gender', 'location', 'isActive'],
    useAsTitle: 'name',
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'bio',
      type: 'textarea',
      required: true,
    },
    {
      name: 'gender',
      type: 'select',
      options: [
        { label: 'Male', value: 'male' },
        { label: 'Female', value: 'female' },
      ],
      required: true,
    },
    {
      name: 'photo',
      type: 'upload',
      relationTo: 'media',
    },
    {
      name: 'calComUsername',
      type: 'text',
      required: true,
      admin: {
        description: 'Cal.com username for booking appointments',
      },
    },
    {
      name: 'location',
      type: 'select',
      options: [{ label: 'Charlevoix', value: 'charlevoix' }],
      required: true,
    },
    {
      name: 'availability',
      type: 'group',
      fields: [
        {
          name: 'mornings',
          type: 'checkbox',
          defaultValue: true,
          label: 'Available Mornings',
        },
        {
          name: 'evenings',
          type: 'checkbox',
          defaultValue: true,
          label: 'Available Evenings',
        },
        {
          name: 'weekdays',
          type: 'checkbox',
          defaultValue: true,
          label: 'Available Weekdays',
        },
        {
          name: 'weekends',
          type: 'checkbox',
          defaultValue: false,
          label: 'Available Weekends',
        },
      ],
    },
    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: true,
      label: 'Active Technician',
      admin: {
        description: 'Inactive technicians will not appear in scheduling',
      },
    },
  ],
  hooks: {
    afterChange: [revalidateTechnicians],
  },
}
