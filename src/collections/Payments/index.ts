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
      index: true,
      admin: {
        description: 'Client this payment belongs to. Cal.com prepayments can exist before a new client is linked.',
      },
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
        { label: 'Refunded', value: 'refunded' },
      ],
      admin: {
        description: 'Only posted payments count toward balances. Voided and refunded records stay for audit history.',
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
      name: 'voidReason',
      type: 'text',
      admin: {
        readOnly: true,
        condition: (_, siblingData) => siblingData?.status === 'voided',
        description: 'Why this payment was reversed while preserving its audit history.',
      },
    },
    {
      name: 'refundedAt',
      type: 'date',
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
        },
        condition: (_, siblingData) => siblingData?.status === 'refunded',
      },
    },
    {
      name: 'refundedAmount',
      type: 'number',
      min: 0,
      admin: {
        step: 1,
        condition: (_, siblingData) => siblingData?.status === 'refunded',
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
      label: 'Receipt',
      admin: {
        initCollapsed: true,
        condition: (_, siblingData) => Boolean(siblingData?.receiptEmail || siblingData?.receiptEmailSentAt),
      },
      fields: [
        {
          name: 'receiptEmail',
          type: 'email',
          admin: {
            readOnly: true,
            description: 'Client email used for the payment receipt.',
          },
        },
        {
          name: 'receiptEmailSentAt',
          type: 'date',
          admin: {
            readOnly: true,
            date: {
              pickerAppearance: 'dayAndTime',
            },
          },
        },
        {
          name: 'receiptType',
          type: 'select',
          options: [
            { label: 'Paid in full', value: 'paid-in-full' },
            { label: 'Partial payment', value: 'partial' },
            { label: 'Client credit added', value: 'credit-added' },
          ],
          admin: {
            readOnly: true,
          },
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
          name: 'workflowOperationId',
          type: 'text',
          index: true,
          admin: {
            readOnly: true,
            description: 'Idempotency key for a guided workflow payment request.',
          },
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
        {
          name: 'stripeRefundId',
          type: 'text',
          index: true,
        },
        {
          name: 'stripeRefundOperationId',
          type: 'text',
          index: true,
          admin: {
            readOnly: true,
            description: 'Idempotency key for the most recent guided refund request.',
          },
        },
        {
          name: 'stripeRefundStatus',
          type: 'select',
          options: [
            { label: 'Pending', value: 'pending' },
            { label: 'Requires action', value: 'requires-action' },
            { label: 'Succeeded', value: 'succeeded' },
            { label: 'Failed', value: 'failed' },
            { label: 'Cancelled', value: 'cancelled' },
          ],
          admin: {
            readOnly: true,
          },
        },
        {
          name: 'pendingRefundAmount',
          type: 'number',
          min: 0,
          admin: {
            readOnly: true,
            step: 1,
          },
        },
        {
          name: 'stripeTerminalReaderId',
          type: 'text',
          index: true,
          admin: {
            readOnly: true,
          },
        },
        {
          name: 'stripeTerminalReaderLabel',
          type: 'text',
          admin: {
            readOnly: true,
          },
        },
        {
          name: 'stripeTerminalLocationId',
          type: 'text',
          admin: {
            readOnly: true,
          },
        },
        {
          name: 'stripeTerminalLocationName',
          type: 'text',
          admin: {
            readOnly: true,
          },
        },
        {
          name: 'stripeTerminalStatus',
          type: 'select',
          options: [
            { label: 'Pending', value: 'pending' },
            { label: 'In progress', value: 'in-progress' },
            { label: 'Succeeded', value: 'succeeded' },
            { label: 'Failed', value: 'failed' },
            { label: 'Cancelled', value: 'cancelled' },
          ],
          admin: {
            readOnly: true,
          },
        },
        {
          name: 'stripeTerminalFailureMessage',
          type: 'text',
          admin: {
            readOnly: true,
          },
        },
        {
          name: 'pendingCreditAmount',
          type: 'number',
          min: 0,
          admin: {
            readOnly: true,
            step: 1,
          },
        },
        {
          name: 'pendingBookingAmountDue',
          type: 'number',
          min: 0,
          admin: {
            readOnly: true,
            step: 1,
          },
        },
        {
          name: 'pendingBookingBalanceDue',
          type: 'number',
          min: 0,
          admin: {
            readOnly: true,
            step: 1,
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

        if (data.status === 'refunded' && !data.refundedAt) {
          data.refundedAt = now
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
