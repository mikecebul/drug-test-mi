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
    defaultColumns: ['headshot', 'name', 'email', 'clientType', 'totalBookings', 'lastBookingDate'],
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
      name: 'headshot',
      type: 'upload',
      relationTo: 'media',
      admin: {
        description: 'Client headshot photo for identification during testing',
      },
      filterOptions: {
        mimeType: {
          contains: 'image',
        },
      },
    },
    {
      name: 'clientType',
      type: 'select',
      options: [
        { label: 'Probation/Court', value: 'probation' },
        { label: 'Employment', value: 'employment' },
      ],
      required: true,
      admin: {
        description: 'Type of client - determines required fields',
      },
    },
    // Probation/Court specific fields
    {
      name: 'courtInfo',
      type: 'group',
      admin: {
        condition: (data, siblingData) => siblingData?.clientType === 'probation',
        description: 'Court and probation officer information',
      },
      fields: [
        {
          name: 'courtName',
          type: 'text',
          required: true,
          admin: {
            description: 'Name of the court',
          },
        },
        {
          name: 'probationOfficerName',
          type: 'text',
          required: true,
          admin: {
            description: 'Name of probation officer',
          },
        },
        {
          name: 'probationOfficerEmail',
          type: 'email',
          required: true,
          admin: {
            description: 'Email of probation officer',
          },
        },
      ],
    },
    // Employment specific fields
    {
      name: 'employmentInfo',
      type: 'group',
      admin: {
        condition: (data, siblingData) => siblingData?.clientType === 'employment',
        description: 'Employer and contact information',
      },
      fields: [
        {
          name: 'employerName',
          type: 'text',
          required: true,
          admin: {
            description: 'Name of employer/company',
          },
        },
        {
          name: 'contactName',
          type: 'text',
          required: true,
          admin: {
            description: 'Name of HR contact or hiring manager',
          },
        },
        {
          name: 'contactEmail',
          type: 'email',
          required: true,
          admin: {
            description: 'Email of HR contact or hiring manager',
          },
        },
      ],
    },
    {
      name: 'notes',
      type: 'textarea',
      admin: {
        description: 'Internal notes about the client',
      },
    },
    // Drug screen results (auto-populated via join)
    {
      name: 'drugScreenResults',
      type: 'join',
      collection: 'media',
      on: 'relatedClient',
      where: {
        isSecure: {
          equals: true,
        },
        documentType: {
          equals: 'drug-screen',
        },
      },
      admin: {
        description: 'Drug screen result documents automatically linked to this client',
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
