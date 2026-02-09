import type { Block } from 'payload'
import { sectionFields } from '../sectionFields'

export const AboutProcess: Block = {
  slug: 'aboutProcess',
  interfaceName: 'AboutProcessBlock',
  labels: {
    singular: 'About Process',
    plural: 'About Process Sections',
  },
  fields: [
    ...sectionFields({
      anchorId: 'how-it-works',
      navLabel: 'How It Works',
      badge: 'Process',
      heading: 'How It Works',
    }),
    {
      name: 'steps',
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
      ],
    },
  ],
}
