import { describe, expect, it, vi, beforeEach } from 'vitest'

import { queueNightlyMissingHeadshotSyncs } from './queueNightlyMissingHeadshotSyncs'
import { queueRedwoodHeadshotSync } from '@/lib/redwood/queue'

vi.mock('@/lib/redwood/queue', () => ({
  queueRedwoodHeadshotSync: vi.fn().mockResolvedValue({ jobId: 'job-1' }),
}))

describe('queueNightlyMissingHeadshotSyncs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('queues eligible clients with completed workflow records and no headshot', async () => {
    const payloadMock: any = {
      find: vi.fn().mockResolvedValue({
        docs: [
          {
            id: 'test-1',
            relatedClient: {
              id: 'client-1',
              firstName: 'Test',
              lastName: 'Client',
              headshot: null,
              redwoodSyncStatus: 'synced',
              redwoodUniqueId: 'RW-1',
            },
          },
          {
            id: 'test-2',
            relatedClient: {
              id: 'client-1',
              firstName: 'Test',
              lastName: 'Client',
              headshot: null,
              redwoodSyncStatus: 'synced',
              redwoodUniqueId: 'RW-1',
            },
          },
          {
            id: 'test-3',
            relatedClient: {
              id: 'client-2',
              firstName: 'Has',
              lastName: 'Photo',
              headshot: 'media-1',
              redwoodSyncStatus: 'synced',
              redwoodUniqueId: 'RW-2',
            },
          },
        ],
        hasNextPage: false,
      }),
      logger: {
        info: vi.fn(),
        error: vi.fn(),
      },
    }

    const result = await queueNightlyMissingHeadshotSyncs(payloadMock)

    expect(result.scannedDrugTests).toBe(3)
    expect(result.queuedClientIds).toEqual(['client-1'])
    expect(result.skippedClientIds).toEqual(['client-2'])
    expect(result.failedClientIds).toEqual([])
    expect(queueRedwoodHeadshotSync).toHaveBeenCalledTimes(1)
    expect(queueRedwoodHeadshotSync).toHaveBeenCalledWith('client-1', undefined, payloadMock)
  })

  it('skips clients that are not Redwood-ready or already in manual review', async () => {
    const payloadMock: any = {
      find: vi.fn().mockResolvedValue({
        docs: [
          {
            id: 'test-1',
            relatedClient: {
              id: 'client-1',
              firstName: 'No',
              lastName: 'Identity',
              headshot: null,
              redwoodSyncStatus: 'not-queued',
              redwoodUniqueId: '',
              redwoodDonorId: '',
            },
          },
          {
            id: 'test-2',
            relatedClient: {
              id: 'client-2',
              firstName: 'Needs',
              lastName: 'Review',
              headshot: null,
              redwoodSyncStatus: 'synced',
              redwoodUniqueId: 'RW-2',
              redwoodHeadshotSyncStatus: 'manual-review',
            },
          },
        ],
        hasNextPage: false,
      }),
      logger: {
        info: vi.fn(),
        error: vi.fn(),
      },
    }

    const result = await queueNightlyMissingHeadshotSyncs(payloadMock)

    expect(result.queuedClientIds).toEqual([])
    expect(result.skippedClientIds).toEqual(['client-1', 'client-2'])
    expect(queueRedwoodHeadshotSync).not.toHaveBeenCalled()
  })
})
