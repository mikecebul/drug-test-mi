import type { CollectionConfig } from 'payload'
import { admins } from '@/access/admins'
import { anyone } from '@/access/anyone'
import { superAdmin } from '@/access/superAdmin'

export const TestTypes: CollectionConfig = {
  slug: 'test-types',
  labels: {
    singular: 'Test Type',
    plural: 'Test Types',
  },
  access: {
    create: admins,
    delete: superAdmin,
    read: anyone,
    update: admins,
  },
  admin: {
    useAsTitle: 'label',
    defaultColumns: ['label', 'value', 'category', 'isActive'],
  },
  fields: [
    {
      name: 'label',
      type: 'text',
      required: true,
      admin: {
        description: 'Human-readable name (e.g., 15-Panel Instant).',
      },
    },
    {
      name: 'value',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: {
        description: 'Canonical key used in code and workflow logic (e.g., 15-panel-instant).',
      },
    },
    {
      name: 'bookingLabel',
      type: 'text',
      admin: {
        description: 'Optional display text for external scheduling tools like Cal.com.',
      },
    },
    {
      name: 'category',
      type: 'select',
      required: true,
      options: [
        { label: 'Instant', value: 'instant' },
        { label: 'Lab', value: 'lab' },
      ],
      admin: {
        description: 'Helps filter test types in future workflows.',
      },
    },
    {
      name: 'redwoodLabTestCode',
      type: 'text',
      admin: {
        condition: (_, siblingData) => siblingData?.category === 'lab',
        description: 'Redwood donor default-test code used on the donor edit screen. Lab test types only.',
      },
      validate: (value, { siblingData }) => {
        if (siblingData?.category !== 'lab') {
          return true
        }

        return typeof value === 'string' && value.trim().length > 0
          ? true
          : 'Redwood lab test code is required when category is Lab.'
      },
    },
    {
      name: 'employers',
      type: 'join',
      collection: 'employers',
      on: 'preferredTestType',
      admin: {
        description: 'Employers currently mapped to this preferred test type.',
      },
    },
    {
      name: 'courts',
      type: 'join',
      collection: 'courts',
      on: 'preferredTestType',
      admin: {
        description: 'Courts currently mapped to this preferred test type.',
      },
    },
    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Inactive test types remain in history but are hidden from new selections.',
      },
    },
  ],
}
