import { admins } from '@/access/admins'
import { CollectionConfig } from 'payload'
import { syncClient } from './hooks/syncClient'

export const Bookings: CollectionConfig = {
  slug: 'bookings',
  labels: {
    singular: 'Booking',
    plural: 'Bookings',
  },
  access: {
    create: admins,
    delete: admins,
    read: admins,
    update: admins,
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'startTime', 'attendeeName', 'attendeeEmail', 'status', 'payment.status'],
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'type',
      type: 'text',
      required: true,
      admin: {
        description: 'Event type duration (e.g., 60min, 30min)',
      },
    },
    {
      name: 'description',
      type: 'textarea',
    },
    {
      name: 'additionalNotes',
      type: 'textarea',
    },
    {
      name: 'startTime',
      type: 'date',
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
      required: true,
    },
    {
      name: 'endTime',
      type: 'date',
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
      required: true,
    },
    {
      name: 'status',
      type: 'select',
      options: [
        { label: 'Confirmed', value: 'confirmed' },
        { label: 'Cancelled', value: 'cancelled' },
        { label: 'Rescheduled', value: 'rescheduled' },
        { label: 'Pending', value: 'pending' },
        { label: 'Rejected', value: 'rejected' },
      ],
      defaultValue: 'confirmed',
      required: true,
    },
    // Organizer information
    {
      name: 'organizer',
      type: 'group',
      fields: [
        {
          name: 'id',
          type: 'number',
        },
        {
          name: 'name',
          type: 'text',
          required: true,
        },
        {
          name: 'email',
          type: 'email',
          required: true,
        },
        {
          name: 'username',
          type: 'text',
        },
        {
          name: 'timeZone',
          type: 'text',
        },
        {
          name: 'timeFormat',
          type: 'text',
        },
      ],
    },
    // Attendee information from responses
    {
      name: 'attendeeName',
      type: 'text',
      required: true,
    },
    {
      name: 'attendeeEmail',
      type: 'email',
      required: true,
    },
    {
      name: 'relatedClient',
      type: 'relationship',
      relationTo: 'clients',
      admin: {
        description: 'Client linked to this booking (auto-populated via email match)',
      },
    },
    {
      name: 'scheduledTestType',
      type: 'relationship',
      relationTo: 'test-types',
      admin: {
        description: 'Test type for this scheduled collection when the referral does not provide one.',
      },
      filterOptions: {
        isActive: {
          equals: true,
        },
      },
    },
    {
      name: 'payment',
      type: 'group',
      admin: {
        description: 'Payment collected before specimen collection.',
      },
      fields: [
        {
          name: 'amountDue',
          type: 'number',
          min: 0,
          admin: {
            step: 1,
          },
        },
        {
          name: 'amountPaid',
          type: 'number',
          min: 0,
          defaultValue: 0,
          admin: {
            step: 1,
          },
        },
        {
          name: 'method',
          type: 'select',
          options: [
            { label: 'Cash', value: 'cash' },
            { label: 'Card', value: 'card' },
            { label: 'Pre-paid', value: 'pre-paid' },
            { label: 'Not Paid', value: 'not-paid' },
          ],
        },
        {
          name: 'status',
          type: 'select',
          options: [
            { label: 'Paid in Full', value: 'paid' },
            { label: 'Partially Paid', value: 'partial' },
            { label: 'Unpaid', value: 'unpaid' },
          ],
        },
        {
          name: 'collectedAt',
          type: 'date',
          admin: {
            date: {
              pickerAppearance: 'dayAndTime',
            },
          },
        },
        {
          name: 'notes',
          type: 'textarea',
        },
      ],
    },
    {
      name: 'sampleCollection',
      type: 'group',
      admin: {
        description: 'Tracks whether the scheduled specimen collection was completed in a workflow.',
      },
      fields: [
        {
          name: 'status',
          type: 'select',
          options: [
            { label: 'Pending', value: 'pending' },
            { label: 'Collected', value: 'collected' },
          ],
          defaultValue: 'pending',
        },
        {
          name: 'collectedAt',
          type: 'date',
          admin: {
            date: {
              pickerAppearance: 'dayAndTime',
            },
          },
        },
        {
          name: 'drugTest',
          type: 'relationship',
          relationTo: 'drug-tests',
        },
      ],
    },
    {
      name: 'location',
      type: 'text',
    },
    // Cal.com specific fields
    {
      name: 'calcomBookingId',
      type: 'text',
      unique: true,
      admin: {
        description: 'Cal.com booking UID',
      },
    },
    {
      name: 'calcomRescheduledFromId',
      type: 'text',
      admin: {
        description: 'Previous Cal.com booking UID when this appointment was rescheduled.',
      },
    },
    {
      name: 'calcomPaymentId',
      type: 'text',
      admin: {
        description: 'Cal.com or Stripe payment identifier when the booking was prepaid.',
      },
    },
    {
      name: 'eventTypeId',
      type: 'number',
    },
    {
      name: 'customInputs',
      type: 'json',
      admin: {
        description: 'Additional form responses from Cal.com',
      },
    },
    {
      name: 'webhookData',
      type: 'json',
      admin: {
        description: 'Raw webhook payload for debugging',
      },
    },
    {
      name: 'createdViaWebhook',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Whether this booking was created via Cal.com webhook',
        readOnly: true,
      },
    },
  ],
  hooks: {
    afterChange: [syncClient],
  },
}
