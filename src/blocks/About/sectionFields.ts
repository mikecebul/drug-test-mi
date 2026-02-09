import type { Field } from 'payload'

type SectionDefaults = {
  anchorId?: string
  navLabel?: string
  badge?: string
  heading?: string
}

export const sectionFields = (defaults: SectionDefaults = {}): Field[] => [
  {
    name: 'anchorId',
    type: 'text',
    required: true,
    defaultValue: defaults.anchorId,
    admin: {
      description: 'Used for on-page anchor; must be unique and lowercase with dashes',
    },
  },
  {
    name: 'navLabel',
    type: 'text',
    required: true,
    defaultValue: defaults.navLabel,
  },
  {
    name: 'badge',
    type: 'text',
    defaultValue: defaults.badge,
  },
  {
    name: 'heading',
    type: 'text',
    defaultValue: defaults.heading,
  },
]
