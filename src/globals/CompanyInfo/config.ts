import { admins } from '@/access/admins'
import { link } from '@/fields/link'
import { revalidatePath } from 'next/cache'
import type { GlobalConfig } from 'payload'

export const CompanyInfo: GlobalConfig = {
  slug: 'company-info',
  label: 'Company Info',
  access: {
    read: admins,
    update: admins,
  },
  hooks: {
    afterChange: [
      ({ req }) => {
        if (req.headers['X-Payload-Migration'] !== 'true') {
          revalidatePath('/(payload)', 'layout')
          revalidatePath('/(frontend)', 'layout')
        }
      },
    ],
  },
  fields: [
    {
      name: 'contact',
      type: 'group',
      admin: {},
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'name',
              type: 'text',
              admin: { width: '50%' },
            },
            {
              name: 'email',
              label: 'Email',
              type: 'text',
              defaultValue: 'info@drugtestmi.com',
              admin: { width: '50%' },
            },
          ],
        },
        {
          type: 'row',
          fields: [
            {
              name: 'phone',
              label: 'Phone Number',
              type: 'text',
              defaultValue: '(231) 547-1144',
              admin: { width: '50%' },
            },
            {
              name: 'fax',
              label: 'Fax',
              type: 'text',
              defaultValue: '(231) 547-4970',
              admin: { width: '50%' },
            },
          ],
        },
        {
          name: 'physicalAddress',
          type: 'group',
          label: 'Physical Address',
          fields: [
            {
              type: 'row',
              fields: [
                {
                  name: 'street',
                  label: 'Street Address',
                  type: 'text',
                  required: true,
                  admin: { width: '50%' },
                },
                {
                  name: 'cityStateZip',
                  label: 'City, State, Zip',
                  type: 'text',
                  required: true,
                  admin: { width: '50%' },
                },
              ],
            },
            {
              name: 'coordinates',
              type: 'point',
              label: 'Map Location',
              admin: {
                description: 'Select the exact location on Google Maps',
              },
            },
            {
              name: 'googleMapLink',
              label: 'Google Maps Link',
              type: 'text',
              admin: {
                description: 'Link to the location on Google Maps',
              },
              defaultValue: 'https://maps.app.goo.gl/Zvr1sGdDdCMfJdwm6'
            },
          ],
        },
        {
          name: 'mailingAddress',
          type: 'group',
          label: 'Mailing Address',
          fields: [
            {
              type: 'row',
              fields: [
                {
                  name: 'street',
                  label: 'Street Address',
                  type: 'text',
                  required: true,
                  admin: { width: '50%' },
                },
                {
                  name: 'cityStateZip',
                  label: 'City, State, Zip',
                  type: 'text',
                  required: true,
                  admin: { width: '50%' },
                },
              ],
            },
          ],
        },
      ],
    },
    {
      name: 'social',
      type: 'array',
      admin: {
        components: {
          RowLabel: '@/globals/CompanyInfo/SocialRowLabel',
        },
      },
      fields: [
        {
          name: 'platform',
          type: 'text',
        },
        link({
          appearances: false,
        }),
      ],
    },
    {
      name: 'hours',
      type: 'array',
      admin: {
        components: {
          RowLabel: '@/globals/CompanyInfo/HoursRowLabel',
        },
      },
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'type',
              type: 'radio',
              admin: {
                layout: 'horizontal',
                width: '50%',
              },
              defaultValue: 'default',
              options: [
                {
                  label: 'Day/Hours',
                  value: 'default',
                },
                {
                  label: 'Custom Note',
                  value: 'custom',
                },
              ],
            },
          ],
        },
        {
          type: 'row',
          admin: {
            condition: (_, siblingData) => siblingData?.type === 'default',
          },
          fields: [
            {
              name: 'day',
              type: 'text',
              admin: { width: '50%' },
            },
            {
              name: 'hours',
              type: 'text',
              admin: { width: '50%' },
            },
          ],
        },
        {
          name: 'note',
          type: 'text',
          admin: {
            condition: (_, siblingData) => siblingData?.type === 'custom',
          },
        },
      ],
    },
    {
      name: 'tests',
      type: 'array',
      label: 'Drug Test Types',
      admin: {
        description: 'Available drug test types with Cal.com booking integration',
        components: {
          RowLabel: '@/globals/CompanyInfo/TestsRowLabel',
        },
      },
      fields: [
        {
          name: 'name',
          type: 'text',
          required: true,
          admin: {
            description: 'Test name (e.g., "Instant 15-Panel")',
          },
        },
        {
          name: 'description',
          type: 'textarea',
          admin: {
            description: 'Description of the test type and when to use it',
          },
        },
        {
          type: 'row',
          fields: [
            {
              name: 'price',
              type: 'number',
              required: true,
              admin: {
                description: 'Price per test in dollars',
                width: '50%',
              },
            },
            {
              name: 'panelCount',
              type: 'number',
              admin: {
                description: 'Number of substances tested (e.g., 11 or 15)',
                width: '50%',
              },
            },
          ],
        },
        {
          name: 'courtLocation',
          type: 'text',
          admin: {
            description: 'Which court/jurisdiction this test is for (e.g., "Charlevoix County" or "Other Courts")',
          },
        },
        {
          type: 'row',
          fields: [
            {
              name: 'allowOneTime',
              type: 'checkbox',
              defaultValue: true,
              label: 'Allow One-Time Appointments',
              admin: {
                description: 'Enable one-time appointments for this test type',
                width: '50%',
              },
            },
            {
              name: 'allowRecurring',
              type: 'checkbox',
              defaultValue: true,
              label: 'Allow Recurring Appointments',
              admin: {
                description: 'Enable recurring appointments for this test type',
                width: '50%',
              },
            },
          ],
        },
        {
          name: 'calcomEventSlugOneTime',
          type: 'text',
          admin: {
            description: 'Cal.com event slug for one-time appointments (e.g., "instant-35-single")',
            condition: (_, siblingData) => siblingData?.allowOneTime === true,
          },
        },
        {
          name: 'calcomEventSlugRecurring',
          type: 'text',
          admin: {
            description: 'Cal.com event slug for recurring appointments (e.g., "instant-35-recurring")',
            condition: (_, siblingData) => siblingData?.allowRecurring === true,
          },
        },
        {
          name: 'icon',
          type: 'select',
          options: [
            { label: 'Instant Test', value: 'instant' },
            { label: 'Lab Test', value: 'lab' },
          ],
          admin: {
            description: 'Icon to display for this test type',
          },
        },
        {
          name: 'isActive',
          type: 'checkbox',
          defaultValue: true,
          admin: {
            description: 'Whether this test type is currently available for booking',
          },
        },
      ],
    },
  ],
}
