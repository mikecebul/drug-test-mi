import { describe, expect, it } from 'vitest'

import {
  hasReadyGuidedRedwoodDonor,
  shouldQueueGuidedRedwoodDonor,
  shouldTreatGuidedRedwoodImportAsFailed,
} from './redwood-provisioning-state'

describe('guided Redwood donor provisioning state', () => {
  it.each(['not-queued', 'failed', 'manual-review'] as const)(
    'queues %s clients so guided collections cannot silently reuse a stale failure',
    (syncStatus) => {
      expect(
        shouldQueueGuidedRedwoodDonor({
          retryFailedDonor: false,
          syncStatus,
        }),
      ).toBe(true)
    },
  )

  it.each(['queued', 'matched-existing', 'reactivated-existing', 'synced'] as const)(
    'does not automatically requeue %s clients',
    (syncStatus) => {
      expect(
        shouldQueueGuidedRedwoodDonor({
          retryFailedDonor: false,
          syncStatus,
        }),
      ).toBe(false)
    },
  )

  it('allows an explicit retry regardless of the stored status', () => {
    expect(
      shouldQueueGuidedRedwoodDonor({
        retryFailedDonor: true,
        syncStatus: 'queued',
      }),
    ).toBe(true)
  })

  it.each(['matched-existing', 'reactivated-existing', 'synced'] as const)(
    'recognizes a donor ID with %s status as ready',
    (syncStatus) => {
      expect(
        hasReadyGuidedRedwoodDonor({
          donorId: '2797573',
          syncStatus,
        }),
      ).toBe(true)
    },
  )

  it('does not let an exhausted historical job override a donor that later synced successfully', () => {
    expect(
      shouldTreatGuidedRedwoodImportAsFailed({
        donorId: '2797573',
        importRetriesExhausted: true,
        syncStatus: 'synced',
      }),
    ).toBe(false)
  })

  it.each([
    { donorId: null, syncStatus: 'failed' as const },
    { donorId: null, syncStatus: 'synced' as const },
    { donorId: '2797573', syncStatus: 'failed' as const },
  ])('keeps an exhausted import failure active until the donor is actually ready', ({ donorId, syncStatus }) => {
    expect(
      shouldTreatGuidedRedwoodImportAsFailed({
        donorId,
        importRetriesExhausted: true,
        syncStatus,
      }),
    ).toBe(true)
  })
})
