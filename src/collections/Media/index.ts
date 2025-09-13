import { CollectionConfig } from 'payload'
import { anyone } from '../../access/anyone'
import { fileURLToPath } from 'url'
import path from 'path'
import { superAdmin } from '@/access/superAdmin'
import { editorOrHigher } from '@/access/editorOrHigher'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export const Media: CollectionConfig = {
  slug: 'media',
  labels: {
    singular: 'Media',
    plural: 'Media',
  },
  access: {
    create: editorOrHigher,
    delete: editorOrHigher,
    read: anyone,
    update: editorOrHigher,
  },
  admin: {
    defaultColumns: ['filename', 'alt', 'updatedAt'],
    group: 'Admin',
    hideAPIURL: !superAdmin,
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
      {
        name: 'meta',
        width: 1200,
        height: 630,
        position: 'top',
        fit: 'inside',
        formatOptions: {
          format: 'webp',
        },
        generateImageName: ({ originalName }) => {
          return `${originalName}-meta`
        },
      },
    ],
    adminThumbnail: 'thumbnail',
    staticDir: path.resolve(dirname, '../../../public/media'),
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
      name: 'caption',
      type: 'text',
      admin: {
        hidden: true,
      },
    },
    {
      name: 'prefix',
      type: 'text',
      admin: {
        hidden: true,
      },
    },
    // Security fields for sensitive documents
    {
      name: 'isSecure',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Mark as secure document (requires authentication to access)',
      },
    },
    {
      name: 'documentType',
      type: 'select',
      options: [
        { label: 'Drug Screen Result', value: 'drug-screen' },
        { label: 'Other Sensitive Document', value: 'other' },
      ],
      admin: {
        description: 'Type of document (for secure files)',
        condition: (data, siblingData) => siblingData?.isSecure,
      },
    },
    {
      name: 'relatedClient',
      type: 'relationship',
      relationTo: 'clients',
      admin: {
        description: 'Client this document belongs to (for secure files)',
        condition: (data, siblingData) => siblingData?.isSecure,
      },
    },
  ],
}
