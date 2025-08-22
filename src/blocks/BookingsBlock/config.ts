import { linkGroup } from '@/fields/link/linkGroup'
import { Block } from 'payload'

export const Bookings: Block = {
  slug: 'bookings',
  labels: {
    singular: 'Bookings Block',
    plural: 'Bookings Blocks',
  },
  interfaceName: 'BookingsBlock',
  fields: [
    {
      name: 'direction',
      type: 'radio',
      defaultValue: 'ltr',
      options: [
        { label: 'Left to Right', value: 'ltr' },
        { label: 'Right to Left', value: 'rtl' },
      ],
    },
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
        admin: {
          components: {
            RowLabel: '@/fields/link/LinkRowLabel',
          },
        },
      },
    }),
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
    },
    {
      name: 'bookingItems',
      type: 'relationship',
      relationTo: 'bookings',
      hasMany: true,
      maxRows: 3,
      admin: {
        description: 'Select up to 3 bookings to display',
      },
    },
  ],
}
