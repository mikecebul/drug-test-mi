import { describe, expect, it } from 'vitest'

import { shouldQueueGuidedRedwoodDonor } from './redwood-provisioning-state'

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
})
