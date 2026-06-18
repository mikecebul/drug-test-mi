import type { Block } from 'payload'
import { sectionFields } from '../sectionFields'
import { DEFAULT_ABOUT_SECTIONS } from '../defaultSections'

const defaultSection = DEFAULT_ABOUT_SECTIONS.find((section) => section.blockType === 'aboutPricing')

export const AboutPricing: Block = {
  slug: 'aboutPricing',
  interfaceName: 'AboutPricingBlock',
  admin: {
    group: 'About Page',
    images: {
      icon: '/admin/block-icons/about-pricing.svg',
      thumbnail: {
        url: '/admin/block-thumbnails/about-pricing.svg',
        alt: 'About pricing block',
      },
    },
  },
  labels: {
    singular: 'About Pricing',
    plural: 'About Pricing Sections',
  },
  fields: [
    ...sectionFields({
      badge: defaultSection?.badge,
      heading: defaultSection?.heading,
    }),
    {
      name: 'pricingCards',
      type: 'array',
      defaultValue: defaultSection?.pricingCards,
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
      defaultValue: defaultSection?.confirmation,
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
