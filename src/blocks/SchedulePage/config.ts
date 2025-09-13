import { Block } from 'payload'

export const SchedulePage: Block = {
  slug: 'schedulePage',
  interfaceName: 'SchedulePageBlock',
  fields: [
    {
      name: 'title',
      type: 'text',
      defaultValue: 'Select your preferred technician and schedule your appointment.',
    },
  ],
}
