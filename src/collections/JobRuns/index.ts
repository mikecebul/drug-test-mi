import type { CollectionConfig } from 'payload'

import { admins } from '@/access/admins'
import { superAdmin } from '@/access/superAdmin'

export const JobRuns: CollectionConfig = {
  slug: 'job-runs',
  labels: {
    singular: 'Job Run',
    plural: 'Job History',
  },
  admin: {
    group: 'Admin',
    useAsTitle: 'taskLabel',
    defaultColumns: ['taskLabel', 'status', 'resultStatus', 'client', 'requestedByAdmin', 'completedAt'],
    description: 'Durable history for tracked background jobs and Redwood sync work.',
  },
  access: {
    read: admins,
    create: () => false,
    update: () => false,
    delete: superAdmin,
  },
  fields: [
    {
      name: 'taskLabel',
      type: 'text',
      required: true,
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'jobId',
      type: 'text',
      required: true,
      index: true,
      admin: {
        readOnly: true,
        description: 'Payload job id used to correlate queue state with this history row.',
      },
    },
    {
      name: 'taskSlug',
      type: 'text',
      required: true,
      index: true,
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'queue',
      type: 'text',
      required: true,
      defaultValue: 'default',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'queued',
      index: true,
      options: [
        {
          label: 'Queued',
          value: 'queued',
        },
        {
          label: 'Running',
          value: 'running',
        },
        {
          label: 'Succeeded',
          value: 'succeeded',
        },
        {
          label: 'Manual Review',
          value: 'manual-review',
        },
        {
          label: 'Failed',
          value: 'failed',
        },
        {
          label: 'Cancelled',
          value: 'cancelled',
        },
      ],
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'resultStatus',
      type: 'text',
      admin: {
        readOnly: true,
        description: 'Underlying task result such as synced, skipped, or partial-success.',
      },
    },
    {
      name: 'client',
      type: 'relationship',
      relationTo: 'clients',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'requestedByAdmin',
      type: 'relationship',
      relationTo: 'admins',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'cancelledByAdmin',
      type: 'relationship',
      relationTo: 'admins',
      admin: {
        readOnly: true,
        condition: (data) => Boolean(data.cancelledByAdmin),
      },
    },
    {
      name: 'source',
      type: 'text',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'changedFieldsCsv',
      type: 'text',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'attemptCount',
      type: 'number',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'summary',
      type: 'textarea',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'errorMessage',
      type: 'textarea',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'screenshotPath',
      type: 'text',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'inputSnapshot',
      type: 'json',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'outputSnapshot',
      type: 'json',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'startedAt',
      type: 'date',
      admin: {
        readOnly: true,
        date: {
          pickerAppearance: 'dayAndTime',
          displayFormat: 'MM/dd/yyyy HH:mm',
        },
      },
    },
    {
      name: 'completedAt',
      type: 'date',
      admin: {
        readOnly: true,
        date: {
          pickerAppearance: 'dayAndTime',
          displayFormat: 'MM/dd/yyyy HH:mm',
        },
      },
    },
  ],
}
