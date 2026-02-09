import type { Block } from 'payload'
import { sectionFields } from '../sectionFields'

export const AboutPricing: Block = {
  slug: 'aboutPricing',
  interfaceName: 'AboutPricingBlock',
  labels: {
    singular: 'About Pricing',
    plural: 'About Pricing Sections',
  },
  fields: [
    ...sectionFields({
      anchorId: 'pricing',
      navLabel: 'Pricing',
      badge: 'Transparent Costs',
      heading: 'Pricing',
    }),
    {
      name: 'pricingCards',
      type: 'array',
      admin: {
        components: {
          RowLabel: '@/components/RowLabel/RowLabelWithTitle',
        },
      },
      fields: [
        {
          name: 'title',
          type: 'text',
          required: true,
        },
        {
          name: 'price',
          type: 'text',
        },
        {
          name: 'description',
          type: 'textarea',
        },
        {
          name: 'featured',
          type: 'checkbox',
          defaultValue: false,
        },
      ],
    },
    {
      name: 'confirmation',
      type: 'group',
      fields: [
        {
          name: 'title',
          type: 'text',
        },
        {
          name: 'rows',
          type: 'array',
          fields: [
            {
              name: 'label',
              type: 'text',
            },
            {
              name: 'value',
              type: 'text',
            },
          ],
        },
      ],
    },
  ],
}
