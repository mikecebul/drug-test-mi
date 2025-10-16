import type { Block } from 'payload'

export const About: Block = {
  slug: 'about',
  interfaceName: 'About',
  fields: [
    {
      name: 'enabled',
      type: 'checkbox',
      label: 'Enable About Block',
      defaultValue: true,
      admin: {
        description: 'Toggle to show/hide the about section on the page',
      },
    },
  ],
  labels: {
    singular: 'About Block',
    plural: 'About Blocks',
  },
}
