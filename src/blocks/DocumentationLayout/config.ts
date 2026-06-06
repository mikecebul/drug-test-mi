import type { Block } from 'payload'

import { AboutContactAvailability } from '@/blocks/About/ContactAvailability/config'
import { AboutMission } from '@/blocks/About/Mission/config'
import { AboutPricing } from '@/blocks/About/Pricing/config'
import { AboutProcess } from '@/blocks/About/Process/config'
import { AboutRegister } from '@/blocks/About/sections/aboutRegister'
import { AboutServices } from '@/blocks/About/Services/config'
import { DEFAULT_ABOUT_SECTIONS } from '@/blocks/About/defaultSections'

export const DocumentationLayout: Block = {
  slug: 'documentationLayout',
  interfaceName: 'DocumentationLayoutBlock',
  admin: {
    group: 'Layouts',
    images: {
      icon: '/admin/block-icons/documentation-layout.svg',
      thumbnail: {
        url: '/admin/block-thumbnails/documentation-layout.svg',
        alt: 'Documentation layout with table of contents and content sections',
      },
    },
  },
  labels: {
    singular: 'Documentation Layout',
    plural: 'Documentation Layouts',
  },
  fields: [
    {
      name: 'tocTitle',
      type: 'text',
      label: 'Table of contents title',
      defaultValue: 'On This Page',
      required: true,
    },
    {
      name: 'sections',
      type: 'blocks',
      blocks: [
        AboutMission,
        AboutServices,
        AboutProcess,
        AboutPricing,
        AboutContactAvailability,
        AboutRegister,
      ],
      defaultValue: DEFAULT_ABOUT_SECTIONS,
      required: true,
    },
  ],
}
