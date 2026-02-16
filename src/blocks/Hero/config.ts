import type { Block } from 'payload'
import { linkGroup } from '@/fields/link/linkGroup'
import { createNormalizeEditorUrlHook } from '@/hooks/normalizeEditorUrl'

const normalizeDirectionsUrlHook = createNormalizeEditorUrlHook({
  allowRelative: true,
  errorMessage: 'Directions URL must be a relative path or valid URL.',
})

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
        {
          label: 'Location Split (Map)',
          value: 'locationSplit',
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
    {
      type: 'group',
      name: 'locationSplit',
      admin: {
        hideGutter: true,
        condition: (_, { type } = {}) => ['locationSplit'].includes(type),
      },
      fields: [
        {
          name: 'badgeText',
          type: 'text',
          defaultValue: 'Accepted by Michigan courts',
          required: true,
        },
        {
          name: 'headingPrefix',
          type: 'text',
          defaultValue: 'Compliant Drug Testing for',
          required: true,
        },
        {
          name: 'headingHighlight',
          type: 'text',
          defaultValue: 'Charlevoix County',
          required: true,
        },
        {
          name: 'description',
          type: 'textarea',
          defaultValue:
            'Run by recovery coaches who understand the journey. Reliable, affordable drug and alcohol testing.',
          required: true,
        },
        {
          name: 'policyNote',
          type: 'text',
          defaultValue: 'We do not book appointments without registering or calling first.',
          required: true,
        },
        {
          name: 'locationText',
          type: 'text',
          defaultValue: 'Clinton St, Charlevoix, Michigan',
          required: true,
        },
        {
          ...linkGroup({
            overrides: {
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
                {
                  link: {
                    type: 'custom',
                    url: 'tel:2313736341',
                    label: 'Call',
                    appearance: 'outline',
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
        },
        {
          type: 'row',
          fields: [
            {
              name: 'mapTitle',
              type: 'text',
              defaultValue: 'MI Drug Test',
              required: true,
              admin: {
                width: '50%',
              },
            },
            {
              name: 'mapSubtitle',
              type: 'text',
              defaultValue: 'Charlevoix, MI 49720',
              required: true,
              admin: {
                width: '50%',
              },
            },
          ],
        },
        {
          name: 'mapImage',
          type: 'upload',
          relationTo: 'media',
        },
        {
          type: 'row',
          fields: [
            {
              name: 'mapFooterText',
              type: 'text',
              defaultValue: 'Downtown Charlevoix',
              required: true,
              admin: {
                width: '50%',
              },
            },
            {
              name: 'directionsLabel',
              type: 'text',
              defaultValue: 'Get Directions',
              required: true,
              admin: {
                width: '50%',
              },
            },
          ],
        },
        {
          name: 'directionsUrl',
          type: 'text',
          defaultValue: 'https://maps.google.com/?q=MI+Drug+Test+Charlevoix+MI',
          required: true,
          hooks: {
            beforeChange: [normalizeDirectionsUrlHook],
          },
        },
      ],
    },
  ],
}
