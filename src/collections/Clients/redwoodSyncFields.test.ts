import { describe, expect, it } from 'vitest'

import {
  REDWOOD_PENDING_CLIENT_UPDATE_FIELDS,
  resolveRedwoodClientUpdateSaveBehavior,
  resolveRedwoodPendingSyncMode,
  shouldAutoQueueApprovedRedwoodClientUpdate,
} from './redwoodSyncFields'

describe('redwoodSyncFields helpers', () => {
  it('queues immediately when no pending Redwood drift exists', () => {
    expect(
      resolveRedwoodClientUpdateSaveBehavior({
        pendingFields: [],
        redwoodClientUpdateStatus: 'failed',
      }),
    ).toBe('queue-now')
  })

  it('keeps additional saves pending when Redwood drift already exists', () => {
    expect(
      resolveRedwoodClientUpdateSaveBehavior({
        pendingFields: ['phone'],
        redwoodClientUpdateStatus: 'failed',
      }),
    ).toBe('save-pending')
  })

  it('keeps additional saves pending while a Redwood client update is queued', () => {
    expect(
      resolveRedwoodClientUpdateSaveBehavior({
        pendingFields: ['phone'],
        redwoodClientUpdateStatus: 'queued',
      }),
    ).toBe('save-pending')
  })

  it('returns a queued split-button state when pending fields exist and Redwood sync is queued', () => {
    expect(
      resolveRedwoodPendingSyncMode({
        eligible: true,
        pendingFields: ['firstName', 'phone'],
        redwoodClientUpdateStatus: 'queued',
      }),
    ).toBe('queued')
  })

  it('auto-queues approved Redwood saves only when the previous doc had no pending drift or queued update', () => {
    expect(
      shouldAutoQueueApprovedRedwoodClientUpdate({
        [REDWOOD_PENDING_CLIENT_UPDATE_FIELDS]: [],
        redwoodClientUpdateStatus: 'synced',
      }),
    ).toBe(true)

    expect(
      shouldAutoQueueApprovedRedwoodClientUpdate({
        [REDWOOD_PENDING_CLIENT_UPDATE_FIELDS]: ['lastName'],
        redwoodClientUpdateStatus: 'failed',
      }),
    ).toBe(false)

    expect(
      shouldAutoQueueApprovedRedwoodClientUpdate({
        [REDWOOD_PENDING_CLIENT_UPDATE_FIELDS]: ['phone'],
        redwoodClientUpdateStatus: 'queued',
      }),
    ).toBe(false)
  })
})
