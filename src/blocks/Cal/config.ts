import { Block } from 'payload'

export const CalendarEmbedBlock: Block = {
  slug: 'calendarEmbed',
  interfaceName: 'CalendarEmbedBlock',
  fields: [
    {
      name: 'title',
      type: 'text',
    },
    {
      name: 'description',
      type: 'text',
    },
    {
      name: 'calLink',
      type: 'text',
      label: 'Cal Link',
      defaultValue: 'mikecebul',
      required: true,
    },
  ],
}
