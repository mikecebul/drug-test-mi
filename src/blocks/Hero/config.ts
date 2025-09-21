import type { Block } from 'payload'
import { linkGroup } from '@/fields/link/linkGroup'

export const Hero: Block = {
  slug: 'hero',
  interfaceName: 'Hero',
  fields: [
    {
      name: 'type',
      type: 'select',
      defaultValue: 'mediumImpact',
      label: 'Type',
      options: [
        {
          label: 'High Impact',
          value: 'highImpact',
        },
        {
          label: 'Medium Impact',
          value: 'mediumImpact',
        },
      ],
      required: true,
    },
    {
      type: 'group',
      name: 'highImpact',
      admin: {
        hideGutter: true,
        condition: (_, { type } = {}) => ['highImpact'].includes(type),
      },
      fields: [
        {
          name: 'title',
          label: 'Title',
          type: 'text',
          defaultValue: 'Drug and Alcohol Testing in Charlevoix County',
          required: true,
        },
        {
          name: 'description',
          label: 'Description',
          type: 'textarea',
          defaultValue:
            'Fast, reliable, and confidential drug testing with certified professionals. Schedule your appointment with our experienced testers available mornings and evenings.',
          required: true,
        },
        linkGroup({
          overrides: {
            maxRows: 2,
            admin: {
              components: {
                RowLabel: '@/fields/link/LinkRowLabel',
              },
            },
          },
        }),
      ],
    },
    {
      type: 'group',
      name: 'mediumImpact',
      admin: {
        hideGutter: true,
        condition: (_, { type } = {}) => ['mediumImpact'].includes(type),
      },
      fields: [
        {
          name: 'subtitle',
          type: 'text',
        },
        {
          type: 'row',
          fields: [
            {
              name: 'title',
              label: 'Title',
              type: 'text',
              defaultValue: 'Substance Use and Mental Health Counseling',
              required: true,
            },
            {
              name: 'heading',
              label: 'Heading',
              type: 'select',
              options: [
                {
                  label: 'H1',
                  value: 'h1',
                },
                {
                  label: 'H2',
                  value: 'h2',
                },
              ],
              defaultValue: 'h2',
            },
          ],
        },
        {
          name: 'description',
          label: 'Description',
          type: 'textarea',
        },
      ],
    },
  ],
}