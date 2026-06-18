import type { Block } from 'payload'
import { sectionFields } from '../sectionFields'
import { iconSelect } from '@/fields/iconSelect/config'
import { DEFAULT_ABOUT_SECTIONS } from '../defaultSections'

const defaultSection = DEFAULT_ABOUT_SECTIONS.find((section) => section.blockType === 'aboutServices')

export const AboutServices: Block = {
  slug: 'aboutServices',
  interfaceName: 'AboutServicesBlock',
  admin: {
    group: 'About Page',
    images: {
      icon: '/admin/block-icons/about-services.svg',
      thumbnail: {
        url: '/admin/block-thumbnails/about-services.svg',
        alt: 'About services block',
      },
    },
  },
  labels: {
    singular: 'About Services',
    plural: 'About Services Sections',
  },
  fields: [
    ...sectionFields({
      badge: defaultSection?.badge,
      heading: defaultSection?.heading,
    }),
    {
      name: 'intro',
      type: 'richText',
      defaultValue: defaultSection?.intro,
    },
    {
      name: 'services',
      type: 'array',
      defaultValue: defaultSection?.services,
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
        iconSelect,
      ],
    },
    {
      name: 'testPanels',
      type: 'array',
      defaultValue: defaultSection?.testPanels,
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
          type: 'text',
        },
      ],
    },
  ],
}
