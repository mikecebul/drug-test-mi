import type { CollectionConfig } from 'payload'
import { admins } from '@/access/admins'
import { superAdmin } from '@/access/superAdmin'

export const SubscriptionProducts: CollectionConfig = {
  slug: 'subscription-products',
  labels: {
    singular: 'Subscription Product',
    plural: 'Subscription Products',
  },
  access: {
    create: superAdmin,
    delete: superAdmin,
    read: () => true,
    update: admins,
  },
  admin: {
    defaultColumns: ['name', 'testsPerMonth', 'pricePerMonth', 'isActive'],
    useAsTitle: 'name',
    group: 'Admin',
    description: 'Manage subscription plans synced with Stripe',
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      admin: {
        description: 'Plan name (e.g., "Weekly Testing", "Bi-Monthly Testing")',
      },
    },
    {
      name: 'description',
      type: 'textarea',
      admin: {
        description: 'Plan description shown to clients',
      },
    },
    {
      name: 'stripePriceId',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        description: 'Stripe Price ID (e.g., price_xxxxx) - create in Stripe Dashboard first',
      },
    },
    {
      name: 'stripeProductId',
      type: 'text',
      required: true,
      admin: {
        description: 'Stripe Product ID (e.g., prod_xxxxx)',
      },
    },
    {
      name: 'testsPerMonth',
      type: 'number',
      required: true,
      min: 1,
      admin: {
        description: 'Number of tests included per month (e.g., 2, 4, 8)',
      },
    },
    {
      name: 'pricePerMonth',
      type: 'number',
      required: true,
      min: 0,
      admin: {
        description: 'Monthly price in cents (e.g., 15000 = $150.00)',
      },
    },
    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Whether this plan is available for new subscriptions',
      },
    },
  ],
}
