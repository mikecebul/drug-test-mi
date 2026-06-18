import type { Block } from 'payload'
import { iconSelect } from '@/fields/iconSelect/config'
import { DEFAULT_TRUST_FEATURES } from './defaultFeatures'

export const Trust: Block = {
  slug: 'trust',
  interfaceName: 'TrustBlock',
  admin: {
    group: 'Front Page',
    images: {
      icon: '/admin/block-icons/trust.svg',
      thumbnail: {
        url: '/admin/block-thumbnails/trust.svg',
        alt: 'Trust block with court approval and three feature cards',
      },
    },
  },
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
      defaultValue: DEFAULT_TRUST_FEATURES,
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
          required: true,
        },
        iconSelect,
      ],
    },
  ],
}
