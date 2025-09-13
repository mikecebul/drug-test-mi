import type { CollectionConfig } from 'payload'
import { editorOrHigher } from '@/access/editorOrHigher'
import { superAdmin } from '@/access/superAdmin'

export const Clients: CollectionConfig = {
  slug: 'clients',
  labels: {
    singular: 'Client',
    plural: 'Clients',
  },
  access: {
    create: editorOrHigher,
    delete: superAdmin,
    read: editorOrHigher,
    update: editorOrHigher,
  },
  admin: {
    defaultColumns: ['name', 'email', 'phone', 'totalBookings', 'lastBookingDate'],
    useAsTitle: 'name',
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      index: true,
    },
    {
      name: 'email',
      type: 'email',
      required: true,
      unique: true,
      index: true,
    },
    {
      name: 'phone',
      type: 'text',
      admin: {
        description: 'Phone number for contact',
      },
    },
    {
      name: 'company',
      type: 'text',
      admin: {
        description: 'Company or organization name',
      },
    },
    {
      name: 'notes',
      type: 'textarea',
      admin: {
        description: 'Internal notes about the client',
      },
    },
    // Calculated fields updated by hooks
    {
      name: 'totalBookings',
      type: 'number',
      defaultValue: 0,
      admin: {
        description: 'Total number of bookings made by this client',
        readOnly: true,
      },
    },
    {
      name: 'lastBookingDate',
      type: 'date',
      admin: {
        description: 'Date of most recent booking',
        readOnly: true,
      },
    },
    {
      name: 'firstBookingDate',
      type: 'date',
      admin: {
        description: 'Date of first booking',
        readOnly: true,
      },
    },
    // Contact preferences
    {
      name: 'preferredContactMethod',
      type: 'select',
      options: [
        { label: 'Email', value: 'email' },
        { label: 'Phone', value: 'phone' },
        { label: 'Text/SMS', value: 'sms' },
      ],
      defaultValue: 'email',
    },
    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Whether this client is active',
      },
    },
  ],
}