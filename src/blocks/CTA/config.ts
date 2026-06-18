import type { Block } from 'payload'
import { linkGroup } from '@/fields/link/linkGroup'

export const CTA: Block = {
  slug: 'cta',
  interfaceName: 'CTABlock',
  admin: {
    group: 'Marketing',
    images: {
      icon: '/admin/block-icons/cta.svg',
      thumbnail: {
        url: '/admin/block-thumbnails/cta.svg',
        alt: 'Call to action block with heading, copy, and buttons',
      },
    },
  },
  labels: {
    singular: 'CTA Block',
    plural: 'CTA Blocks',
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      label: 'Title',
      defaultValue: 'Ready to get started?',
      required: true,
    },
    {
      name: 'description',
      type: 'textarea',
      label: 'Description',
      defaultValue:
        'Register your account to schedule appointments, manage your testing history, and receive results.',
    },
    linkGroup({
      overrides: {
        label: 'CTA Links',
        maxRows: 2,
        defaultValue: [
          {
            link: {
              type: 'custom',
              url: '/register',
              label: 'Register',
              appearance: 'default',
              newTab: false,
            },
          },
        ],
        admin: {
          components: {
            RowLabel: '@/fields/link/LinkRowLabel',
          },
        },
      },
    }),
  ],
}
