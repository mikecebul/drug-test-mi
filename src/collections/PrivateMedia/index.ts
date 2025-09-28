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

      // Users from the clients collection can only access their own documents
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
    description: 'Secure file storage for sensitive documents',
  },
  upload: {
    staticDir: path.resolve(dirname, '../../../private-media'),
    mimeTypes: ['application/pdf', 'image/*'],
    disableLocalStorage: false,
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: false,
      admin: {
        description: 'Alternative text for SEO and accessibility',
      },
      defaultValue: 'Document',
    },
    {
      name: 'documentType',
      type: 'select',
      required: true,
      options: [
        { label: 'Drug Test Report', value: 'drug-test-report' },
        { label: 'Client Document', value: 'client-document' },
      ],
      admin: {
        description: 'Type of private document',
      },
    },
    {
      name: 'relatedClient',
      type: 'relationship',
      relationTo: 'clients',
      required: false,
      admin: {
        description: 'Client this document belongs to',
      },
    },
  ],
}
