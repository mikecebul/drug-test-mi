import type { CollectionConfig } from 'payload'
import { admins } from '@/access/admins'

/** Snapshot of the balances included in a Stripe invoice. Records are written by the billing service. */
export const ReferralInvoices: CollectionConfig = {
  slug: 'referral-invoices',
  labels: { singular: 'Referral Invoice', plural: 'Referral Invoices' },
  access: {
    create: () => false,
    read: admins,
    update: () => false,
    delete: () => false,
  },
  admin: {
    group: 'Admin',
    useAsTitle: 'billingKey',
    defaultColumns: ['billingKey', 'status', 'amount', 'unappliedAmount', 'stripeInvoiceId', 'createdAt'],
    description: 'Monthly Stripe invoices sent to billable court and employer referrals.',
  },
  fields: [
    { name: 'billingKey', type: 'text', required: true, unique: true, index: true },
    { name: 'billingMonth', type: 'text', required: true, index: true },
    { name: 'referral', type: 'relationship', relationTo: ['courts', 'employers'], required: true, index: true },
    { name: 'billingEmail', type: 'email', required: true },
    { name: 'amount', type: 'number', required: true, min: 0 },
    {
      name: 'unappliedAmount',
      type: 'number',
      defaultValue: 0,
      min: 0,
      admin: {
        readOnly: true,
        description: 'Invoice payment that could not be applied to test balances. Review for a referral refund or credit.',
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      options: [
        { label: 'Preparing', value: 'preparing' },
        { label: 'Sent', value: 'sent' },
        { label: 'Paid', value: 'paid' },
        { label: 'Voided', value: 'void' },
      ],
    },
    { name: 'stripeCustomerId', type: 'text' },
    { name: 'stripeInvoiceId', type: 'text', index: true },
    { name: 'replacesInvoice', type: 'relationship', relationTo: 'referral-invoices' },
    { name: 'replacesInvoiceNumber', type: 'text' },
    { name: 'hostedInvoiceUrl', type: 'text' },
    { name: 'invoicePdfUrl', type: 'text' },
    { name: 'sentAt', type: 'date' },
    { name: 'emailSentAt', type: 'date' },
    { name: 'paidAt', type: 'date' },
    {
      name: 'paymentMethod',
      type: 'select',
      options: [
        { label: 'Online', value: 'stripe' },
        { label: 'Check', value: 'check' },
      ],
      admin: { readOnly: true },
    },
    { name: 'checkNumber', type: 'text', admin: { readOnly: true } },
    { name: 'checkReceivedAt', type: 'date', admin: { readOnly: true } },
    {
      name: 'payments',
      type: 'join',
      collection: 'payments',
      on: 'relatedReferralInvoice',
      admin: { defaultColumns: ['amount', 'method', 'collectedAt'] },
    },
    { name: 'voidedAt', type: 'date' },
    {
      name: 'items',
      type: 'array',
      required: true,
      minRows: 1,
      fields: [
        { name: 'drugTest', type: 'relationship', relationTo: 'drug-tests', required: true },
        { name: 'client', type: 'relationship', relationTo: 'clients', required: true },
        { name: 'clientName', type: 'text', required: true },
        { name: 'collectionDate', type: 'date', required: true },
        { name: 'testType', type: 'text', required: true },
        { name: 'amount', type: 'number', required: true, min: 0 },
      ],
    },
  ],
}
