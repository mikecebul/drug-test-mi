import type { Block } from 'payload'

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
  ],
}