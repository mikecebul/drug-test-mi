import type { Block } from 'payload'
import { linkGroup } from '@/fields/link/linkGroup'

export const TechniciansBlock: Block = {
  slug: 'techniciansBlock',
  interfaceName: 'TechniciansBlock',
  labels: {
    singular: 'Technicians Block',
    plural: 'Technicians Blocks',
  },
  fields: [
    {
      name: 'heading',
      type: 'text',
      label: 'Heading',
      defaultValue: 'Our Technicians',
    },
    {
      name: 'description',
      type: 'textarea',
      label: 'Description',
      defaultValue: 'Meet our drug testing professionals. Each technician is trained, experienced, and committed to providing professional and discreet testing services.',
    },
    {
      name: 'maxTechnicians',
      type: 'number',
      label: 'Max Technicians to Display',
      defaultValue: 6,
      min: 1,
      max: 20,
    },
    {
      name: 'schedulingInfo',
      type: 'richText',
      label: 'Scheduling Information',
      admin: {
        description: 'Information about appointment availability and scheduling guidelines',
      },
    },
    linkGroup({
      overrides: {
        label: 'Call to Action',
        admin: {
          description: 'Add button(s) for scheduling appointments',
        },
      },
    }),
  ],
}