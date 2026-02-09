import type { Block } from 'payload'
import { AboutMission } from './sections/aboutMission'
import { AboutServices } from './sections/aboutServices'
import { AboutProcess } from './sections/aboutProcess'
import { AboutPricing } from './sections/aboutPricing'
import { AboutRegister } from './sections/aboutRegister'
import { AboutContact } from './sections/aboutContact'
import { DEFAULT_ABOUT_SECTIONS } from './defaultSections'

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
    {
      name: 'sections',
      type: 'blocks',
      required: true,
      defaultValue: DEFAULT_ABOUT_SECTIONS,
      blocks: [
        AboutMission,
        AboutServices,
        AboutProcess,
        AboutPricing,
        AboutContact,
        AboutRegister,
      ],
    },
  ],
  labels: {
    singular: 'About Block',
    plural: 'About Blocks',
  },
}
