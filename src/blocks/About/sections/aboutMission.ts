import type { Block } from 'payload'
import { sectionFields } from '../sectionFields'

export const AboutMission: Block = {
  slug: 'aboutMission',
  interfaceName: 'AboutMissionBlock',
  labels: {
    singular: 'About Mission',
    plural: 'About Mission Sections',
  },
  fields: [
    ...sectionFields({
      anchorId: 'mission',
      navLabel: 'Our Mission',
      badge: 'About Us',
      heading: 'Our Mission',
    }),
    {
      name: 'intro',
      type: 'richText',
    },
  ],
}
