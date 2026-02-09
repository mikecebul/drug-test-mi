import type { Block } from 'payload'
import { sectionFields } from '../sectionFields'
import { iconSelect } from '@/fields/iconSelect/config'

export const AboutServices: Block = {
  slug: 'aboutServices',
  interfaceName: 'AboutServicesBlock',
  labels: {
    singular: 'About Services',
    plural: 'About Services Sections',
  },
  fields: [
    ...sectionFields({
      anchorId: 'services',
      navLabel: 'Our Services',
      badge: 'What We Offer',
      heading: 'Our Services',
    }),
    {
      name: 'intro',
      type: 'richText',
    },
    {
      name: 'services',
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
          name: 'description',
          type: 'textarea',
        },
        iconSelect,
      ],
    },
    {
      name: 'testPanels',
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
          name: 'description',
          type: 'text',
        },
      ],
    },
  ],
}
