import type { CollectionConfig } from 'payload'
import { admins } from '@/access/admins'

export const Payments: CollectionConfig = {
  slug: 'payments',
  labels: {
    singular: 'Payment',
    plural: 'Payments',
  },
  access: {
    create: admins,
    delete: admins,
    read: ({ req: { user } }) => {
      if (!user) return false

      // Admins can read all payments
      if (user.collection === 'admins') {
        return true
      }

      // Clients can only read their own payments
      if (user.collection === 'clients') {
        return {
          relatedClient: {
            equals: user.id,
          },
        }
      }

      return false
    },
    update: admins,
  },
  admin: {
    defaultColumns: ['relatedClient', 'amount', 'status', 'billingDate'],
    useAsTitle: 'stripeInvoiceId',
    group: 'Admin',
    description: 'Track subscription payments from Stripe',
  },
  fields: [
    {
      name: 'stripeInvoiceId',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        description: 'Stripe Invoice ID',
        readOnly: true,
      },
    },
    {
      name: 'relatedClient',
      type: 'relationship',
      relationTo: 'clients',
      required: true,
      admin: {
        description: 'Client who made this payment',
      },
    },
    {
      name: 'stripeSubscriptionId',
      type: 'text',
      admin: {
        description: 'Stripe Subscription ID',
        readOnly: true,
      },
    },
    {
      name: 'amount',
      type: 'number',
      required: true,
      min: 0,
      admin: {
        description: 'Amount in cents',
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      options: [
        { label: 'Paid', value: 'paid' },
        { label: 'Failed', value: 'failed' },
      ],
      admin: {
        description: 'Payment status',
      },
    },
    {
      name: 'billingDate',
      type: 'date',
      required: true,
      admin: {
        description: 'Date of billing',
        date: {
          pickerAppearance: 'dayOnly',
          displayFormat: 'MM/dd/yyyy',
        },
      },
    },
    {
      name: 'invoicePdf',
      type: 'text',
      admin: {
        description: 'URL to Stripe invoice PDF',
      },
    },
  ],
}
