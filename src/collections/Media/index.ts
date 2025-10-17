import { CollectionConfig } from 'payload'
import { anyone } from '../../access/anyone'
import { fileURLToPath } from 'url'
import path from 'path'
import { superAdmin } from '@/access/superAdmin'
import { admins } from '@/access/admins'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export const Media: CollectionConfig = {
  slug: 'media',
  labels: {
    singular: 'Media',
    plural: 'Media',
  },
  access: {
    create: admins,
    delete: admins,
    read: anyone,
    update: admins,
  },
  admin: {
    defaultColumns: ['filename', 'alt', 'updatedAt'],
    group: 'Admin',
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
  ],
}
