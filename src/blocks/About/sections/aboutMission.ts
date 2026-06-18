import type { Block } from 'payload'
import { sectionFields } from '../sectionFields'
import { DEFAULT_ABOUT_SECTIONS } from '../defaultSections'

const defaultSection = DEFAULT_ABOUT_SECTIONS.find((section) => section.blockType === 'aboutMission')

export const AboutMission: Block = {
  slug: 'aboutMission',
  interfaceName: 'AboutMissionBlock',
  admin: {
    group: 'About Page',
    images: {
      icon: '/admin/block-icons/about-mission.svg',
      thumbnail: {
        url: '/admin/block-thumbnails/about-mission.svg',
        alt: 'About mission block',
      },
    },
  },
  labels: {
    singular: 'About Mission',
    plural: 'About Mission Sections',
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
  ],
}
