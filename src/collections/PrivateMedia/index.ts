import { CollectionConfig } from 'payload'
import { superAdmin } from '@/access/superAdmin'
import { admins } from '@/access/admins'
import { fileURLToPath } from 'url'
import path from 'path'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export const PrivateMedia: CollectionConfig = {
  slug: 'private-media',
  labels: {
    singular: 'Private Media',
    plural: 'Private Media',
  },
  access: {
    create: admins,
    delete: superAdmin,
    read: ({ req: { user } }) => {
      if (!user) return false

      // Users from the users collection (admins) can access all private media
      if (user.collection === 'admins') {
        return true
      }

      // Users from the clients collection can only access their own drug test reports
      if (user.collection === 'clients') {
        return {
          relatedClient: {
            equals: user.id,
          },
        }
      }

      return false
    },
    update: admins,
  },
  admin: {
    defaultColumns: ['filename', 'documentType', 'relatedClient', 'updatedAt'],
    group: 'Admin',
    description: 'Secure file storage for sensitive documents like drug test results',
  },
  upload: {
    formatOptions: {
      format: 'webp',
    },
    resizeOptions: {
      width: 1600,
      height: undefined,
    },
    imageSizes: [
      {
        name: 'thumbnail',
        width: 300,
        height: 300,
        formatOptions: {
          format: 'webp',
        },
        generateImageName: ({ originalName }) => {
          return `${originalName}-thumbnail`
        },
      },
    ],
    adminThumbnail: 'thumbnail',
    staticDir: path.resolve(dirname, '../../../private-media'),
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
      admin: {
        description: 'Alternative text for SEO and accessibility',
      },
    },
    {
      name: 'documentType',
      type: 'select',
      required: true,
      options: [
        { label: 'Drug Screen Result', value: 'drug-screen' },
        { label: 'Lab Report', value: 'lab-report' },
        { label: 'Other Sensitive Document', value: 'other' },
      ],
      admin: {
        description: 'Type of sensitive document',
      },
    },
    {
      name: 'relatedClient',
      type: 'relationship',
      relationTo: 'clients',
      required: true,
      admin: {
        description: 'Client this document belongs to',
      },
    },
    {
      name: 'testDate',
      type: 'date',
      admin: {
        description: 'Date the test was conducted (if applicable)',
        condition: (data, siblingData) => siblingData?.documentType === 'drug-screen',
      },
    },
    {
      name: 'notes',
      type: 'textarea',
      admin: {
        description: 'Internal notes about this document',
      },
    },
    {
      name: 'prefix',
      type: 'text',
      admin: {
        hidden: true,
      },
    },
  ],
}
