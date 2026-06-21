import type { CollectionConfig } from 'payload'

/**
 * Admin Alerts Collection
 *
 * Tracks business-critical failures that require admin attention.
 * Designed for high-severity issues only (email failures, data integrity issues, etc.)
 *
 * Lower-priority errors should be tracked in Sentry/Glitchtip.
 */
export const AdminAlerts: CollectionConfig = {
  slug: 'admin-alerts',
  labels: {
    singular: 'Alert',
    plural: 'Alerts',
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'jobType', 'client', 'attemptCount', 'resolved', 'lastSeenAt'],
    group: 'Admin',
    description: 'Business-critical alerts requiring admin attention',
  },
  access: {
    // Only super admins can view alerts
    read: ({ req: { user } }) => {
      if (!user) return false
      return user.collection === 'admins' && user.role === 'superAdmin'
    },
    create: () => true, // System can create alerts
    update: ({ req: { user } }) => {
      if (!user) return false
      return user.collection === 'admins' && user.role === 'superAdmin'
    },
    delete: ({ req: { user } }) => {
      if (!user) return false
      return user.collection === 'admins' && user.role === 'superAdmin'
    },
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      admin: {
        description: 'Brief description of the alert',
      },
    },
    {
      name: 'severity',
      type: 'select',
      required: true,
      defaultValue: 'high',
      options: [
        {
          label: 'Critical',
          value: 'critical',
        },
        {
          label: 'High',
          value: 'high',
        },
        {
          label: 'Medium',
          value: 'medium',
        },
      ],
      admin: {
        description: 'Severity level of the alert',
      },
    },
    {
      name: 'alertType',
      type: 'select',
      required: true,
      options: [
        {
          label: 'Email Failure',
          value: 'email-failure',
        },
        {
          label: 'Recipient Fetch Failure',
          value: 'recipient-fetch-failure',
        },
        {
          label: 'Document Missing',
          value: 'document-missing',
        },
        {
          label: 'Notification History Failure',
          value: 'notification-history-failure',
        },
        {
          label: 'Data Integrity Issue',
          value: 'data-integrity',
        },
        {
          label: 'Other',
          value: 'other',
        },
      ],
      admin: {
        description: 'Category of the alert',
      },
    },
    {
      name: 'message',
      type: 'textarea',
      required: true,
      admin: {
        description: 'Detailed description of the issue and recommended action',
      },
    },
    {
      name: 'context',
      type: 'json',
      admin: {
        description: 'Additional context (client ID, drug test ID, error details, etc.)',
      },
    },
    {
      name: 'client',
      type: 'relationship',
      relationTo: 'clients',
      admin: {
        description: 'Client impacted by the alert, when applicable.',
      },
    },
    {
      name: 'jobType',
      type: 'select',
      options: [
        { label: 'Redwood Import', value: 'import' },
        { label: 'Redwood Client Update', value: 'client-update' },
        { label: 'Redwood Headshot Sync', value: 'headshot-sync' },
        { label: 'Redwood Headshot Upload', value: 'headshot-upload' },
        { label: 'Redwood Unique ID Sync', value: 'unique-id-sync' },
        { label: 'Redwood Default Test Sync', value: 'default-test-sync' },
      ],
      admin: {
        description: 'Workflow or Redwood job type associated with this alert.',
      },
    },
    {
      name: 'dedupeKey',
      type: 'text',
      index: true,
      admin: {
        readOnly: true,
        description: 'Stable incident key used to dedupe repeated Redwood failures.',
      },
    },
    {
      name: 'statusSnapshot',
      type: 'json',
      admin: {
        description: 'Latest Redwood status snapshot captured when the alert was last seen.',
      },
    },
    {
      name: 'screenshotPath',
      type: 'text',
      admin: {
        description: 'Latest local screenshot path captured for this alert, if any.',
      },
    },
    {
      name: 'attemptCount',
      type: 'number',
      defaultValue: 1,
      admin: {
        readOnly: true,
        description: 'How many times this same incident has been observed.',
      },
    },
    {
      name: 'lastSeenAt',
      type: 'date',
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
          displayFormat: 'MM/dd/yyyy HH:mm',
        },
        description: 'When this incident was most recently observed.',
      },
    },
    {
      name: 'recommendedAction',
      type: 'textarea',
      admin: {
        description: 'Short operator guidance for triage and recovery.',
      },
    },
    {
      name: 'resolved',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Mark as resolved once the issue has been addressed',
      },
    },
    {
      name: 'resolvedAt',
      type: 'date',
      admin: {
        description: 'When this alert was resolved',
        condition: (data) => data.resolved === true,
      },
    },
    {
      name: 'resolvedBy',
      type: 'relationship',
      relationTo: 'admins',
      admin: {
        description: 'Admin who resolved this alert',
        condition: (data) => data.resolved === true,
      },
    },
    {
      name: 'notes',
      type: 'textarea',
      admin: {
        description: 'Resolution notes or actions taken',
        condition: (data) => data.resolved === true,
      },
    },
  ],
  hooks: {
    beforeChange: [
      ({ data, req, operation }) => {
        // Auto-set resolvedAt when marking as resolved
        if (operation === 'update' && data.resolved && !data.resolvedAt) {
          data.resolvedAt = new Date().toISOString()
          data.resolvedBy = req.user?.id
        }
        return data
      },
    ],
  },
}
