import type { CollectionConfig } from 'payload'

import { admins } from '@/access/admins'
import { superAdmin } from '@/access/superAdmin'

export const Payments: CollectionConfig = {
  slug: 'payments',
  labels: {
    singular: 'Payment',
    plural: 'Payments',
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'relatedClient', 'amount', 'method', 'status', 'collectedAt'],
    group: 'Admin',
    description: 'Ledger of collected, linked, and credited client payments.',
  },
  access: {
    create: admins,
    read: admins,
    update: superAdmin,
    delete: superAdmin,
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'relatedClient',
      type: 'relationship',
      relationTo: 'clients',
      required: true,
      index: true,
    },
    {
      name: 'relatedDrugTest',
      type: 'relationship',
      relationTo: 'drug-tests',
      index: true,
    },
    {
      name: 'relatedBooking',
      type: 'relationship',
      relationTo: 'bookings',
      index: true,
    },
    {
      name: 'amount',
      type: 'number',
      required: true,
      min: 0,
      admin: {
        step: 1,
        description: 'Total money collected or applied in this payment record.',
      },
    },
    {
      name: 'method',
      type: 'select',
      required: true,
      defaultValue: 'unknown',
      options: [
        { label: 'Cash', value: 'cash' },
        { label: 'Card', value: 'card' },
        { label: 'Stripe', value: 'stripe' },
        { label: 'Pre-paid', value: 'pre-paid' },
        { label: 'Client Credit', value: 'credit' },
        { label: 'Unknown', value: 'unknown' },
      ],
    },
    {
      name: 'source',
      type: 'select',
      required: true,
      defaultValue: 'manual',
      options: [
        { label: 'Guided Workflow', value: 'guided-workflow' },
        { label: 'Drug Test Tracker', value: 'test-tracker' },
        { label: 'Stripe Checkout', value: 'stripe-checkout' },
        { label: 'Cal.com', value: 'calcom' },
        { label: 'Credit Application', value: 'credit-application' },
        { label: 'Manual', value: 'manual' },
      ],
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'posted',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Posted', value: 'posted' },
        { label: 'Voided', value: 'voided' },
      ],
      admin: {
        description: 'Only posted payments count toward balances. Voided records stay for audit history.',
      },
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
      name: 'postedAt',
      type: 'date',
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
        },
        condition: (_, siblingData) => siblingData?.status === 'posted',
      },
    },
    {
      name: 'voidedAt',
      type: 'date',
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
        },
        condition: (_, siblingData) => siblingData?.status === 'voided',
      },
    },
    {
      type: 'collapsible',
      label: 'Allocation',
      admin: {
        initCollapsed: false,
      },
      fields: [
        {
          name: 'reservedForBookingAmount',
          type: 'number',
          defaultValue: 0,
          min: 0,
          admin: {
            readOnly: true,
            step: 1,
            description: 'Amount reserved for a scheduled booking before the drug test exists.',
          },
        },
        {
          name: 'appliedAmount',
          type: 'number',
          defaultValue: 0,
          min: 0,
          admin: {
            readOnly: true,
            step: 1,
            description: 'Amount applied to existing drug-test balances.',
          },
        },
        {
          name: 'creditAmount',
          type: 'number',
          defaultValue: 0,
          min: 0,
          admin: {
            readOnly: true,
            step: 1,
            description: 'Unapplied amount retained as client credit.',
          },
        },
        {
          name: 'allocations',
          type: 'array',
          admin: {
            readOnly: true,
            description: 'Drug-test balances paid by this record, oldest first.',
          },
          fields: [
            {
              name: 'drugTest',
              type: 'relationship',
              relationTo: 'drug-tests',
              required: true,
            },
            {
              name: 'amount',
              type: 'number',
              required: true,
              min: 0,
              admin: {
                step: 1,
              },
            },
          ],
        },
      ],
    },
    {
      type: 'collapsible',
      label: 'Stripe',
      admin: {
        initCollapsed: true,
        condition: (_, siblingData) => siblingData?.method === 'stripe' || siblingData?.source === 'stripe-checkout',
      },
      fields: [
        {
          name: 'stripeCheckoutSessionId',
          type: 'text',
          index: true,
        },
        {
          name: 'stripePaymentIntentId',
          type: 'text',
          index: true,
        },
        {
          name: 'stripeCheckoutUrl',
          type: 'text',
        },
        {
          name: 'paymentLinkEmailSentAt',
          type: 'date',
          admin: {
            date: {
              pickerAppearance: 'dayAndTime',
            },
          },
        },
      ],
    },
  ],
  hooks: {
    beforeChange: [
      ({ data }) => {
        const now = new Date().toISOString()

        if (!data.collectedAt) {
          data.collectedAt = now
        }

        if (data.status === 'posted' && !data.postedAt) {
          data.postedAt = now
        }

        if (data.status === 'voided' && !data.voidedAt) {
          data.voidedAt = now
        }

        const amount = typeof data.amount === 'number' ? data.amount : 0
        const method = typeof data.method === 'string' ? data.method : 'unknown'
        const date = new Date(data.collectedAt).toLocaleDateString('en-US')
        data.title = `${method.replaceAll('-', ' ')} payment - $${amount.toFixed(2)} - ${date}`

        return data
      },
    ],
  },
}
