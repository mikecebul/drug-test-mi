import type { Block } from 'payload'
import { sectionFields } from '../sectionFields'
import { linkGroup } from '@/fields/link/linkGroup'
import { DEFAULT_ABOUT_SECTIONS } from '../defaultSections'

const defaultSection = DEFAULT_ABOUT_SECTIONS.find((section) => section.blockType === 'aboutRegister')

export const AboutRegister: Block = {
  slug: 'aboutRegister',
  interfaceName: 'AboutRegisterBlock',
  labels: {
    singular: 'About Register',
    plural: 'About Register Sections',
  },
  fields: [
    ...sectionFields({
      badge: defaultSection?.badge,
      heading: defaultSection?.heading,
    }),
    {
      name: 'title',
      type: 'text',
      defaultValue: defaultSection?.title,
    },
    {
      name: 'body',
      type: 'richText',
      defaultValue: defaultSection?.body,
    },
    linkGroup({
      overrides: {
        defaultValue: defaultSection?.links,
        admin: {
          components: {
            RowLabel: '@/fields/link/LinkRowLabel',
          },
        },
      },
    }),
    {
      name: 'footerText',
      type: 'text',
      defaultValue: defaultSection?.footerText,
    },
  ],
}
