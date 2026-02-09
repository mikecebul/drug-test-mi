import type { Block } from 'payload'
import { sectionFields } from '../sectionFields'
import { linkGroup } from '@/fields/link/linkGroup'

export const AboutRegister: Block = {
  slug: 'aboutRegister',
  interfaceName: 'AboutRegisterBlock',
  labels: {
    singular: 'About Register',
    plural: 'About Register Sections',
  },
  fields: [
    ...sectionFields({
      anchorId: 'register',
      navLabel: 'Get Started',
      badge: 'Get Started',
      heading: 'Ready to Schedule?',
    }),
    {
      name: 'title',
      type: 'text',
      defaultValue: 'Create Your Account',
    },
    {
      name: 'body',
      type: 'richText',
    },
    linkGroup({
      overrides: {
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
    },
  ],
}
