import { Block } from 'payload'

export const BookingCards: Block = {
  slug: 'bookingCards',
  interfaceName: 'BookingCardsBlock',
  labels: {
    singular: 'Booking Cards',
    plural: 'Booking Card Blocks',
  },
  fields: [
    {
      name: 'bookingCards',
      type: 'relationship',
      relationTo: 'bookings',
      hasMany: true,
      minRows: 3,
      maxRows: 3,
      admin: {
        description: 'Select up to 3 bookings to display',
      },
    },
  ],
}
