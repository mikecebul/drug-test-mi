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
    hidden: true,
    useAsTitle: 'label',
    defaultColumns: ['label', 'value', 'category', 'price', 'toxAccessCode', 'isActive'],
    description:
      'Legacy collection retained only for historical migration compatibility. Runtime test types live in src/config/test-types.ts.',
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
      options: [
        { label: 'Instant', value: 'instant' },
        { label: 'Lab', value: 'lab' },
      ],
      admin: {
        description: 'Legacy migration metadata only.',
      },
    },
    {
      name: 'price',
      type: 'number',
      required: true,
      min: 0,
      admin: {
        description: 'Legacy migration metadata only.',
        step: 1,
      },
    },
    {
      name: 'toxAccessCode',
      label: 'Test Code',
      type: 'text',
      admin: {
        description: 'Legacy migration metadata only.',
        condition: (_, siblingData) => siblingData?.category === 'lab',
      },
    },
    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Legacy migration metadata only.',
      },
    },
  ],
}
