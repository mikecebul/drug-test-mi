import { Block } from 'payload'

export const BookingsPage: Block = {
  slug: 'bookingsPage',
  interfaceName: 'BookingsPageBlock',
  labels: {
    singular: 'Bookings Page',
    plural: 'Bookings Pages',
  },
  fields: [
    {
      name: 'title',
      label: 'Title',
      type: 'text',
    },
    {
      name: 'bookingCards',
      type: 'relationship',
      relationTo: 'bookings',
      hasMany: true,
    },
    {
      name: 'announcements',
      type: 'array',
      label: 'Announcements',
      admin: {
        initCollapsed: true,
        components: {
          RowLabel: '@/components/RowLabel/RowLabelWithTitle',
        },
      },
      fields: [
        {
          name: 'title',
          label: 'Title',
          type: 'text',
          required: true,
        },
        {
          name: 'description',
          label: 'Description',
          type: 'richText',
          required: true,
        },
      ],
    },
  ],
}
