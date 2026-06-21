import type { Field } from 'payload'

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
  admin: {
    readOnly: true,
    description,
  },
})

export const redwoodDefaultTestTypeField: Field = {
  name: 'defaultTestType',
  type: 'relationship',
  relationTo: 'test-types',
  admin: {
    readOnly: true,
    description: 'Stored recommended test type used by Redwood default-test jobs.',
  },
}

export const redwoodSyncTab: ClientTab = {
  label: 'Redwood Sync',
  description: 'Redwood integration and worker status',
  fields: [
    {
      name: 'redwoodSyncStatus',
      type: 'select',
      defaultValue: 'not-queued',
      options: [
        { label: 'Not Queued', value: 'not-queued' },
        { label: 'Queued', value: 'queued' },
        { label: 'Export Checked', value: 'export-checked' },
        { label: 'Matched Existing', value: 'matched-existing' },
        { label: 'Ready To Submit', value: 'ready-to-submit' },
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
      name: 'redwoodUniqueId',
      type: 'text',
      maxLength: 20,
      admin: {
        description: 'Deterministic Redwood Unique ID (20 chars max).',
      },
    },
    {
      name: 'redwoodCallInCode',
      type: 'text',
      admin: {
        readOnly: true,
        description: 'Redwood call-in / check-in code synced back from the donor record.',
      },
    },
    {
      name: 'redwoodDonorId',
      type: 'text',
      admin: {
        readOnly: true,
        description: 'Redwood donor ID captured from the donor detail URL for direct follow-up lookups.',
      },
    },
    {
      name: 'redwoodClientUpdateStatus',
      type: 'select',
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
    redwoodTimestampField('redwoodClientUpdateLastAttemptAt', 'Timestamp of the most recent Redwood client update attempt.'),
    redwoodErrorField('redwoodClientUpdateLastError', 'Most recent Redwood client update error message, if any.'),
    {
      name: 'redwoodUniqueIdSyncStatus',
      type: 'select',
      defaultValue: 'not-queued',
      options: redwoodStatusOptions,
      admin: {
        readOnly: true,
        description: 'Tracks Redwood donor unique ID backfill state.',
      },
    },
    redwoodTimestampField('redwoodUniqueIdLastAttemptAt', 'Timestamp of the most recent Redwood unique ID backfill attempt.'),
    redwoodErrorField('redwoodUniqueIdLastError', 'Most recent Redwood unique ID backfill error message, if any.'),
    {
      name: 'redwoodHeadshotSyncStatus',
      type: 'select',
      defaultValue: 'not-queued',
      options: redwoodStatusOptions,
      admin: {
        readOnly: true,
        description: 'Tracks Redwood-to-website headshot sync state.',
      },
    },
    redwoodTimestampField('redwoodHeadshotSyncLastAttemptAt', 'Timestamp of the most recent Redwood headshot sync attempt.'),
    redwoodErrorField('redwoodHeadshotSyncLastError', 'Most recent Redwood headshot sync error message, if any.'),
    {
      name: 'redwoodHeadshotPushStatus',
      type: 'select',
      defaultValue: 'not-queued',
      options: redwoodStatusOptions,
      admin: {
        readOnly: true,
        description: 'Tracks website-to-Redwood headshot upload state.',
      },
    },
    redwoodTimestampField('redwoodHeadshotPushLastAttemptAt', 'Timestamp of the most recent Redwood headshot upload attempt.'),
    redwoodErrorField('redwoodHeadshotPushLastError', 'Most recent Redwood headshot upload error message, if any.'),
    {
      name: 'redwoodDefaultTestSyncStatus',
      type: 'select',
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
    redwoodTimestampField('redwoodDefaultTestLastAttemptAt', 'Timestamp of the most recent Redwood default-test sync attempt.'),
    redwoodErrorField('redwoodDefaultTestLastError', 'Most recent Redwood default-test sync error message, if any.'),
    {
      name: 'redwoodMatchedBy',
      type: 'select',
      options: [
        { label: 'Unique ID', value: 'unique-id' },
        { label: 'Email', value: 'email' },
        { label: 'Name + DOB', value: 'name-dob' },
        { label: 'Name + DOB (Fuzzy)', value: 'name-dob-fuzzy' },
      ],
      admin: {
        readOnly: true,
        description: 'How this client was matched in Redwood export.',
      },
    },
    {
      name: 'redwoodMatchedDonorName',
      type: 'text',
      admin: {
        readOnly: true,
        description: 'Matched donor identifier from Redwood export.',
      },
    },
    {
      name: 'redwoodImportScreenshotPath',
      type: 'text',
      admin: {
        readOnly: true,
        description: 'Local screenshot path captured at Redwood pre-submit state.',
      },
    },
    redwoodTimestampField('redwoodLastAttemptAt', 'Timestamp of most recent Redwood worker attempt.'),
    redwoodErrorField('redwoodLastError', 'Most recent Redwood worker error message, if any.'),
  ],
}
