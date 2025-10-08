import { admins } from '@/access/admins'
import { CollectionConfig } from 'payload'

export const Appointments: CollectionConfig = {
  slug: 'appointments',
  labels: {
    singular: 'Appointment',
    plural: 'Appointments',
  },
  access: {
    create: admins,
    delete: admins,
    read: admins,
    update: admins,
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'client', 'frequency', 'nextOccurrence', 'isActive'],
    description: 'Recurring appointments for clients',
    group: 'Bookings',
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      admin: {
        description: 'Appointment title (e.g., "Weekly Drug Test")',
      },
    },
    {
      name: 'client',
      type: 'relationship',
      relationTo: 'clients',
      required: true,
      admin: {
        description: 'Client this recurring appointment is for',
      },
    },
    {
      name: 'frequency',
      type: 'select',
      required: true,
      options: [
        { label: 'Weekly', value: 'weekly' },
        { label: 'Bi-weekly', value: 'biweekly' },
        { label: 'Monthly', value: 'monthly' },
        { label: 'Custom', value: 'custom' },
      ],
      defaultValue: 'weekly',
      admin: {
        description: 'How often does this appointment recur?',
      },
    },
    {
      name: 'dayOfWeek',
      type: 'select',
      options: [
        { label: 'Monday', value: 'monday' },
        { label: 'Tuesday', value: 'tuesday' },
        { label: 'Wednesday', value: 'wednesday' },
        { label: 'Thursday', value: 'thursday' },
        { label: 'Friday', value: 'friday' },
        { label: 'Saturday', value: 'saturday' },
        { label: 'Sunday', value: 'sunday' },
      ],
      admin: {
        condition: (data, siblingData) =>
          siblingData?.frequency === 'weekly' || siblingData?.frequency === 'biweekly',
        description: 'Which day of the week?',
      },
    },
    {
      name: 'dayOfMonth',
      type: 'number',
      min: 1,
      max: 31,
      admin: {
        condition: (data, siblingData) => siblingData?.frequency === 'monthly',
        description: 'Which day of the month (1-31)?',
      },
    },
    {
      name: 'time',
      type: 'text',
      required: true,
      admin: {
        description: 'Appointment time (e.g., "10:00 AM")',
        placeholder: '10:00 AM',
      },
    },
    {
      name: 'duration',
      type: 'number',
      defaultValue: 30,
      admin: {
        description: 'Duration in minutes',
      },
    },
    {
      name: 'startDate',
      type: 'date',
      required: true,
      admin: {
        description: 'When does this recurring appointment start?',
        date: {
          pickerAppearance: 'dayOnly',
          displayFormat: 'MM/dd/yyyy',
        },
      },
    },
    {
      name: 'endDate',
      type: 'date',
      admin: {
        description: 'When does this recurring appointment end? (leave empty for indefinite)',
        date: {
          pickerAppearance: 'dayOnly',
          displayFormat: 'MM/dd/yyyy',
        },
      },
    },
    {
      name: 'nextOccurrence',
      type: 'date',
      admin: {
        description: 'Next scheduled occurrence of this appointment',
        date: {
          pickerAppearance: 'dayAndTime',
          displayFormat: 'MM/dd/yyyy h:mm a',
        },
      },
    },
    {
      name: 'isPrepaid',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Has the client prepaid for these recurring appointments?',
      },
    },
    {
      name: 'paymentStatus',
      type: 'select',
      options: [
        { label: 'Active - Paid', value: 'active' },
        { label: 'Past Due', value: 'past_due' },
        { label: 'Canceled', value: 'canceled' },
        { label: 'Pending Setup', value: 'pending' },
      ],
      defaultValue: 'pending',
      admin: {
        description: 'Current payment status',
      },
    },
    {
      name: 'stripeSubscriptionId',
      type: 'text',
      admin: {
        description: 'Stripe subscription ID if using recurring billing',
      },
    },
    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Is this recurring appointment currently active?',
      },
    },
    {
      name: 'notes',
      type: 'textarea',
      admin: {
        description: 'Additional notes about this recurring appointment',
      },
    },
  ],
}
