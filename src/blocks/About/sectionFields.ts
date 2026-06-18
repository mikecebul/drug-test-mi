import type { Field } from 'payload'

type SectionDefaults = {
  badge?: string
  heading?: string
}

export const sectionFields = (defaults: SectionDefaults = {}): Field[] => [
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
