import type { CollectionConfig } from 'payload'
import { admins } from '@/access/admins'
import { superAdmin } from '@/access/superAdmin'

export const ScheduleOverrides: CollectionConfig = {
  slug: 'schedule-overrides',
  access: {
    create: admins,
    delete: superAdmin,
    read: admins,
    update: admins,
  },
  admin: {
    useAsTitle: 'date',
    group: 'Scheduling',
    defaultColumns: ['date', 'timeSlot', 'originalTechnician', 'coveringTechnician', 'reason'],
    description: 'Manage temporary schedule changes, swaps, and coverage',
  },
  fields: [
    {
      name: 'date',
      type: 'date',
      required: true,
      admin: {
        description: 'Date of the schedule override',
        date: {
          pickerAppearance: 'dayOnly',
        },
      },
    },
    {
      name: 'timeSlot',
      type: 'select',
      options: [
        { label: 'Morning (8AM-12PM)', value: 'morning' },
        { label: 'Afternoon (12PM-5PM)', value: 'afternoon' },
        { label: 'Late Morning (10AM-12PM)', value: 'late-morning' },
      ],
      required: true,
      admin: {
        description: 'Time slot for the override',
      },
    },
    {
      name: 'originalTechnician',
      type: 'relationship',
      relationTo: 'technicians',
      admin: {
        description: 'Technician originally scheduled',
      },
    },
    {
      name: 'coveringTechnician',
      type: 'relationship',
      relationTo: 'technicians',
      required: true,
      admin: {
        description: 'Technician covering this time slot',
      },
    },
    {
      name: 'reason',
      type: 'select',
      options: [
        { label: 'Schedule Swap', value: 'swap' },
        { label: 'Coverage Needed', value: 'coverage' },
        { label: 'Vacation', value: 'vacation' },
        { label: 'Sick Leave', value: 'sick' },
        { label: 'Other', value: 'other' },
      ],
      required: true,
      admin: {
        description: 'Reason for the schedule change',
      },
    },
    {
      name: 'notes',
      type: 'textarea',
      admin: {
        description: 'Additional notes about this override',
      },
    },
  ],
}
