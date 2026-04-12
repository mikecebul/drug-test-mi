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
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'severity', 'alertType', 'resolved', 'createdAt'],
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
