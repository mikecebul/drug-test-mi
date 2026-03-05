import { authenticatedOrPublished } from '@/access/authenticatedOrPublished'
import { admins } from '@/access/admins'
import { linkGroup } from '@/fields/link/linkGroup'
import { CollectionConfig } from 'payload'

export const Resources: CollectionConfig = {
  slug: 'resources',
  access: {
    create: admins,
    delete: admins,
    read: authenticatedOrPublished,
    update: admins,
  },
  labels: {
    singular: 'Resource',
    plural: 'Resources',
  },
  admin: {
    useAsTitle: 'title',
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'description',
      type: 'textarea',
      required: true,
    },
    linkGroup({
      overrides: {
        maxRows: 2,
      },
    }),
  ],
}
