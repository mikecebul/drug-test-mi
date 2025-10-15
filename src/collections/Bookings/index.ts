import { authenticatedOrPublished } from '@/access/authenticatedOrPublished'
import { admins } from '@/access/admins'
import { revalidatePath } from 'next/cache'
import { CollectionConfig } from 'payload'
import { setClientRelationship, syncClient } from './hooks/syncClient'
import { syncPhoneWithClient } from './hooks/syncPhoneWithClient'

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
    defaultColumns: ['title', 'startTime', 'attendeeName', 'attendeeEmail', 'status', 'createdViaWebhook'],
    listSearchableFields: ['title', 'attendeeName', 'attendeeEmail'],
    group: 'Bookings',
  },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Booking Details',
          fields: [
            {
              name: 'relatedClient',
              type: 'relationship',
              relationTo: 'clients',
              admin: {
                description: 'Client associated with this booking (auto-populated from email)',
              },
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'attendeeName',
                  type: 'text',
                  required: true,
                  admin: {
                    width: '50%',
                  },
                },
                {
                  name: 'attendeeEmail',
                  type: 'email',
                  required: true,
                  admin: {
                    width: '50%',
                  },
                },
              ],
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'phone',
                  type: 'text',
                  required: true,
                  admin: {
                    description: 'Phone number from booking (auto-synced with client)',
                    width: '50%',
                  },
                },
                {
                  name: 'phoneHistory',
                  type: 'array',
                  admin: {
                    description: 'Historical phone numbers for this client (for detecting typos)',
                    width: '50%',
                    readOnly: true,
                  },
                  fields: [
                    {
                      name: 'number',
                      type: 'text',
                      required: true,
                    },
                    {
                      name: 'changedAt',
                      type: 'date',
                      required: true,
                      admin: {
                        date: {
                          pickerAppearance: 'dayAndTime',
                        },
                      },
                    },
                  ],
                },
              ],
            },
            {
              name: 'title',
              type: 'text',
              required: true,
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'startTime',
                  type: 'date',
                  admin: {
                    date: {
                      pickerAppearance: 'dayAndTime',
                    },
                    width: '50%',
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
                    width: '50%',
                  },
                  required: true,
                },
              ],
            },
            {
              type: 'row',
              fields: [
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
                  admin: {
                    width: '50%',
                  },
                },
                {
                  name: 'createdViaWebhook',
                  type: 'checkbox',
                  defaultValue: false,
                  admin: {
                    description: 'Booked via CalCom',
                    readOnly: true,
                    width: '50%',
                  },
                },
              ],
            },
            {
              name: 'recurringBookingUid',
              type: 'text',
              admin: {
                description: 'Cal.com recurring booking UID (links all occurrences in a series)',
                readOnly: true,
              },
            },
            {
              name: 'calcomEventSlug',
              type: 'text',
              admin: {
                description: 'Cal.com event slug used for this booking (for rescheduling)',
                readOnly: true,
              },
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
              name: 'location',
              type: 'text',
            },
            {
              name: 'description',
              type: 'textarea',
            },
            {
              name: 'additionalNotes',
              type: 'textarea',
            },
          ],
        },
        {
          label: 'CalCom Data',
          description: 'Raw data from CalCom webhook (for debugging)',
          fields: [
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
              name: 'organizer',
              type: 'group',
              label: 'Organizer Information',
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
          ],
        },
      ],
    },
  ],
  hooks: {
    beforeChange: [setClientRelationship],
    afterChange: [syncClient, syncPhoneWithClient],
  },
}
