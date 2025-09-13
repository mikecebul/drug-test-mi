import { authenticatedOrPublished } from '@/access/authenticatedOrPublished'
import { editorOrHigher } from '@/access/editorOrHigher'
import { revalidatePath } from 'next/cache'
import { CollectionConfig } from 'payload'
import { syncClient } from './hooks/syncClient'

export const Bookings: CollectionConfig = {
  slug: 'bookings',
  labels: {
    singular: 'Booking',
    plural: 'Bookings',
  },
  access: {
    create: () => true, // Allow webhooks to create
    delete: editorOrHigher,
    read: authenticatedOrPublished,
    update: editorOrHigher,
  },
  admin: {
    useAsTitle: 'title',
    hideAPIURL: true, // Always hide API URL for security
    defaultColumns: ['title', 'startTime', 'attendeeName', 'attendeeEmail', 'status'],
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
    afterChange: [
      syncClient,
    ],
  },
}