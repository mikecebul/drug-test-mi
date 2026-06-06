import type { Block } from 'payload'
import { sectionFields } from '../sectionFields'
import { iconSelect } from '@/fields/iconSelect/config'
import { DEFAULT_ABOUT_SECTIONS } from '../defaultSections'

const defaultSection = DEFAULT_ABOUT_SECTIONS.find((section) => section.blockType === 'aboutContact')

export const AboutContact: Block = {
  slug: 'aboutContact',
  interfaceName: 'AboutContactBlock',
  admin: {
    group: 'About Page',
    images: {
      icon: '/admin/block-icons/about-contact.svg',
      thumbnail: {
        url: '/admin/block-thumbnails/about-contact.svg',
        alt: 'About contact and availability block',
      },
    },
  },
  labels: {
    singular: 'About Contact & Availability',
    plural: 'About Contact & Availability Sections',
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
      name: 'availability',
      type: 'group',
      defaultValue: defaultSection?.availability,
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
      defaultValue: defaultSection?.contactItems,
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
      defaultValue: defaultSection?.footerText,
    },
  ],
}
