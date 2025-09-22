import type { Block } from 'payload'
import { iconSelect } from '@/fields/iconSelect/config'

export const Trust: Block = {
  slug: 'trust',
  interfaceName: 'TrustBlock',
  labels: {
    singular: 'Trust Block',
    plural: 'Trust Blocks',
  },
  fields: [
    {
      name: 'heading',
      type: 'text',
      label: 'Heading',
      defaultValue: 'Why Choose MI Drug Test?',
    },
    {
      name: 'description',
      type: 'textarea',
      label: 'Description',
      defaultValue: 'Trusted testing provider with official pre-approval from local courts',
    },
    {
      name: 'features',
      type: 'array',
      label: 'Trust Features',
      minRows: 3,
      maxRows: 3,
      fields: [
        {
          name: 'title',
          type: 'text',
          label: 'Feature Title',
          required: true,
        },
        {
          name: 'description',
          type: 'textarea',
          label: 'Feature Description',
        },
        iconSelect,
      ],
    },
  ],
}
