import type { Field, FieldAccess } from 'payload'

import { testTypeSelectOptions } from '@/config/test-types'

import {
  getRedwoodClientUpdateFieldLabel,
  REDWOOD_CLIENT_UPDATE_FIELDS,
  REDWOOD_PENDING_CLIENT_UPDATE_FIELDS,
} from './redwoodSyncFields'

type ClientTab = {
  label: string
  description?: string
  fields: Field[]
}

const denyRedwoodManagedFieldWrite: FieldAccess = () => false
const allowAdminRedwoodFieldRead: FieldAccess = ({ req }) => req.user?.collection === 'admins'

/**
 * Redwood integration state is visible to admins but may only be written by
 * trusted Local API calls using `overrideAccess: true`.
 */
export const redwoodSystemFieldAccess = {
  create: denyRedwoodManagedFieldWrite,
  read: allowAdminRedwoodFieldRead,
  update: denyRedwoodManagedFieldWrite,
}

const redwoodStatusOptions = [
  { label: 'Not Queued', value: 'not-queued' },
  { label: 'Queued', value: 'queued' },
  { label: 'Synced', value: 'synced' },
  { label: 'Failed', value: 'failed' },
  { label: 'Manual Review', value: 'manual-review' },
]

const redwoodTimestampField = (name: string, description: string): Field => ({
  name,
  type: 'date',
  access: redwoodSystemFieldAccess,
  admin: {
    readOnly: true,
    date: {
      pickerAppearance: 'dayAndTime',
      displayFormat: 'MM/dd/yyyy HH:mm',
    },
    description,
  },
})

const redwoodErrorField = (name: string, description: string): Field => ({
  name,
  type: 'textarea',
  access: redwoodSystemFieldAccess,
  admin: {
    readOnly: true,
    description,
  },
})

export const redwoodDefaultTestTypeField: Field = {
  name: 'defaultTestType',
  label: 'Default Test Type',
  type: 'select',
  options: testTypeSelectOptions,
  access: redwoodSystemFieldAccess,
  admin: {
    readOnly: true,
    description: 'Stored configured test type inherited from the selected court or employer referral.',
  },
}

export const redwoodSyncTab: ClientTab = {
  label: 'ToxAccess',
  description: 'Donor connection status in ToxAccess',
  fields: [
    {
      name: 'redwoodSyncStatus',
      type: 'select',
      access: redwoodSystemFieldAccess,
      defaultValue: 'not-queued',
      options: [
        { label: 'Not Queued', value: 'not-queued' },
        { label: 'Queued', value: 'queued' },
        { label: 'Matched Existing', value: 'matched-existing' },
        { label: 'Reactivated Existing', value: 'reactivated-existing' },
        { label: 'Synced', value: 'synced' },
        { label: 'Failed', value: 'failed' },
        { label: 'Manual Review', value: 'manual-review' },
      ],
      admin: {
        readOnly: true,
        description: 'Current Redwood sync state managed by the background worker.',
      },
    },
    {
      name: 'redwoodDonorId',
      type: 'text',
      access: redwoodSystemFieldAccess,
      admin: {
        readOnly: true,
        description: 'ToxAccess donor ID used for direct collection links.',
      },
    },
    {
      name: 'redwoodAccountNumber',
      type: 'text',
      access: redwoodSystemFieldAccess,
      admin: {
        readOnly: true,
        description: 'ToxAccess account that currently owns the donor and controls account-level collection settings.',
      },
    },
    {
      type: 'collapsible',
      label: 'Technical sync details',
      admin: {
        initCollapsed: true,
        description: 'Worker diagnostics and audit details. Expand only when troubleshooting a sync.',
      },
      fields: [
        {
          name: 'redwoodCallInCode',
          type: 'text',
          access: redwoodSystemFieldAccess,
          admin: {
            readOnly: true,
            description: 'Redwood call-in / check-in code synced back from the donor record.',
          },
        },
        {
          name: 'redwoodClientUpdateStatus',
          type: 'select',
          access: redwoodSystemFieldAccess,
          defaultValue: 'not-queued',
          options: redwoodStatusOptions,
          admin: {
            readOnly: true,
            description: 'Tracks batched Payload-to-Redwood client field updates.',
          },
        },
        {
          name: REDWOOD_PENDING_CLIENT_UPDATE_FIELDS,
          type: 'select',
          access: redwoodSystemFieldAccess,
          hasMany: true,
          options: REDWOOD_CLIENT_UPDATE_FIELDS.map((field) => ({
            label: getRedwoodClientUpdateFieldLabel(field),
            value: field,
          })),
          admin: {
            readOnly: true,
            description:
              'Redwood-backed fields whose latest saved values have not been confirmed back into Redwood yet.',
          },
        },
        redwoodTimestampField(
          'redwoodClientUpdateLastAttemptAt',
          'Timestamp of the most recent Redwood client update attempt.',
        ),
        redwoodErrorField('redwoodClientUpdateLastError', 'Most recent Redwood client update error message, if any.'),
        {
          name: 'redwoodHeadshotPushStatus',
          type: 'select',
          access: redwoodSystemFieldAccess,
          defaultValue: 'not-queued',
          options: redwoodStatusOptions,
          admin: {
            readOnly: true,
            description: 'Tracks website-to-Redwood headshot upload state.',
          },
        },
        redwoodTimestampField(
          'redwoodHeadshotPushLastAttemptAt',
          'Timestamp of the most recent Redwood headshot upload attempt.',
        ),
        redwoodErrorField('redwoodHeadshotPushLastError', 'Most recent Redwood headshot upload error message, if any.'),
        {
          name: 'redwoodDefaultTestSyncStatus',
          type: 'select',
          access: redwoodSystemFieldAccess,
          defaultValue: 'not-queued',
          options: [
            { label: 'Not Queued', value: 'not-queued' },
            { label: 'Queued', value: 'queued' },
            { label: 'Skipped', value: 'skipped' },
            { label: 'Synced', value: 'synced' },
            { label: 'Failed', value: 'failed' },
            { label: 'Manual Review', value: 'manual-review' },
          ],
          admin: {
            readOnly: true,
            description: 'Tracks Redwood donor default-test sync state.',
          },
        },
        {
          name: 'redwoodDefaultTestSyncedCode',
          type: 'text',
          access: redwoodSystemFieldAccess,
          admin: {
            readOnly: true,
            description: 'Last Redwood default-test code managed by the website sync job.',
          },
        },
        redwoodTimestampField(
          'redwoodDefaultTestLastAttemptAt',
          'Timestamp of the most recent Redwood default-test sync attempt.',
        ),
        redwoodErrorField(
          'redwoodDefaultTestLastError',
          'Most recent Redwood default-test sync error message, if any.',
        ),
        {
          name: 'redwoodInactivationStatus',
          type: 'select',
          access: redwoodSystemFieldAccess,
          defaultValue: 'not-queued',
          options: redwoodStatusOptions,
          admin: {
            readOnly: true,
            description: 'Tracks website inactive-client sync to Redwood donor inactive status.',
          },
        },
        redwoodTimestampField(
          'redwoodInactivationLastAttemptAt',
          'Timestamp of the most recent Redwood inactivation attempt.',
        ),
        redwoodErrorField('redwoodInactivationLastError', 'Most recent Redwood inactivation error message, if any.'),
        {
          name: 'redwoodMatchedDonorName',
          type: 'text',
          access: redwoodSystemFieldAccess,
          admin: {
            readOnly: true,
            description: 'Matched donor identifier from Redwood export.',
          },
        },
      ],
    },
    redwoodTimestampField('redwoodLastAttemptAt', 'Timestamp of most recent Redwood worker attempt.'),
    redwoodErrorField('redwoodLastError', 'Most recent Redwood worker error message, if any.'),
  ],
}
