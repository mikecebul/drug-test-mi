import type { Block } from 'payload'
import { sectionFields } from '../sectionFields'
import { iconSelect } from '@/fields/iconSelect/config'

export const AboutContact: Block = {
  slug: 'aboutContact',
  interfaceName: 'AboutContactBlock',
  labels: {
    singular: 'About Contact & Availability',
    plural: 'About Contact & Availability Sections',
  },
  fields: [
    ...sectionFields({
      anchorId: 'contact',
      navLabel: 'Contact & Availability',
      badge: 'Get In Touch',
      heading: 'Contact & Availability',
    }),
    {
      name: 'intro',
      type: 'richText',
    },
    {
      name: 'availability',
      type: 'group',
      fields: [
        {
          name: 'title',
          type: 'text',
        },
        {
          name: 'times',
          type: 'array',
          fields: [
            {
              name: 'text',
              type: 'text',
            },
          ],
        },
        {
          name: 'notes',
          type: 'array',
          fields: [
            {
              name: 'text',
              type: 'text',
            },
          ],
        },
      ],
    },
    {
      name: 'contactItems',
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
        {
          name: 'href',
          type: 'text',
        },
        iconSelect,
      ],
    },
    {
      name: 'footerText',
      type: 'text',
    },
  ],
}
