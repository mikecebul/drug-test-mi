import type { Block } from 'payload'
import { sectionFields } from '../sectionFields'
import { DEFAULT_ABOUT_SECTIONS } from '../defaultSections'

const defaultSection = DEFAULT_ABOUT_SECTIONS.find((section) => section.blockType === 'aboutProcess')

export const AboutProcess: Block = {
  slug: 'aboutProcess',
  interfaceName: 'AboutProcessBlock',
  admin: {
    group: 'About Page',
    images: {
      icon: '/admin/block-icons/about-process.svg',
      thumbnail: {
        url: '/admin/block-thumbnails/about-process.svg',
        alt: 'About process block',
      },
    },
  },
  labels: {
    singular: 'About Process',
    plural: 'About Process Sections',
  },
  fields: [
    ...sectionFields({
      badge: defaultSection?.badge,
      heading: defaultSection?.heading,
    }),
    {
      name: 'steps',
      type: 'array',
      defaultValue: defaultSection?.steps,
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
