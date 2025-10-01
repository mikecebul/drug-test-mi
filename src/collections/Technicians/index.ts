import type { CollectionConfig } from 'payload'
import { admins } from '@/access/admins'
import { superAdmin } from '@/access/superAdmin'
import { revalidateTechnicians } from './hooks/revalidateTechnicians'
import { anyone } from '@/access/anyone'

export const Technicians: CollectionConfig = {
  slug: 'technicians',
  access: {
    create: admins,
    delete: superAdmin,
    read: anyone,
    update: admins,
  },
  admin: {
    defaultColumns: ['name', 'gender', 'location', 'isActive'],
    useAsTitle: 'name',
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'email',
      type: 'email',
      required: true,
      admin: {
        description: 'Email for notifications about assigned tests',
      },
    },
    {
      name: 'phone',
      type: 'text',
      admin: {
        description: 'Phone number for contact',
      },
    },
    {
      name: 'bio',
      type: 'textarea',
      required: true,
    },
    {
      name: 'gender',
      type: 'select',
      options: [
        { label: 'Male', value: 'male' },
        { label: 'Female', value: 'female' },
      ],
      required: true,
    },
    {
      name: 'photo',
      type: 'upload',
      relationTo: 'media',
    },
    {
      name: 'calComUsername',
      type: 'text',
      required: true,
      admin: {
        description: 'Cal.com username for booking appointments',
      },
    },
    {
      name: 'location',
      type: 'select',
      options: [{ label: 'Charlevoix', value: 'charlevoix' }],
      required: true,
    },
    {
      name: 'availability',
      type: 'group',
      fields: [
        {
          name: 'mornings',
          type: 'checkbox',
          defaultValue: true,
          label: 'Available Mornings',
        },
        {
          name: 'evenings',
          type: 'checkbox',
          defaultValue: true,
          label: 'Available Evenings',
        },
        {
          name: 'weekdays',
          type: 'checkbox',
          defaultValue: true,
          label: 'Available Weekdays',
        },
        {
          name: 'weekends',
          type: 'checkbox',
          defaultValue: false,
          label: 'Available Weekends',
        },
      ],
    },
    {
      name: 'regularSchedule',
      type: 'array',
      admin: {
        description: 'Regular weekly schedule for automated assignment',
      },
      fields: [
        {
          name: 'dayOfWeek',
          type: 'select',
          options: [
            { label: 'Monday', value: 'monday' },
            { label: 'Tuesday', value: 'tuesday' },
            { label: 'Wednesday', value: 'wednesday' },
            { label: 'Thursday', value: 'thursday' },
            { label: 'Friday', value: 'friday' },
            { label: 'Saturday', value: 'saturday' },
            { label: 'Sunday', value: 'sunday' },
          ],
          required: true,
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
        },
        {
          name: 'startTime',
          type: 'text',
          required: true,
          admin: {
            description: 'Start time (e.g., 8:00 AM)',
          },
        },
        {
          name: 'endTime',
          type: 'text',
          required: true,
          admin: {
            description: 'End time (e.g., 12:00 PM)',
          },
        },
        {
          name: 'isActive',
          type: 'checkbox',
          defaultValue: true,
          label: 'Active Schedule Slot',
          admin: {
            description: 'Uncheck to temporarily disable this schedule slot',
          },
        },
      ],
    },
    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: true,
      label: 'Active Technician',
      admin: {
        description: 'Inactive technicians will not appear in scheduling',
      },
    },
  ],
  hooks: {
    afterChange: [revalidateTechnicians],
  },
}
