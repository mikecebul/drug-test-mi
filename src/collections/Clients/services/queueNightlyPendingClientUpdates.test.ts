import type { Payload } from 'payload'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { queueRedwoodClientUpdate } from '@/lib/redwood/queue'
import { queueNightlyPendingClientUpdates } from './queueNightlyPendingClientUpdates'

vi.mock('@/lib/redwood/queue', () => ({
  queueRedwoodClientUpdate: vi.fn().mockResolvedValue({ jobId: 'job-1' }),
}))

describe('queueNightlyPendingClientUpdates', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('queues Redwood-linked clients with pending update fields', async () => {
    const payloadMock = {
      find: vi.fn().mockResolvedValue({
        docs: [
          {
            id: 'client-1',
            redwoodDonorId: 'RW-1',
            redwoodSyncStatus: 'synced',
            redwoodPendingSyncFields: ['phone'],
          },
          {
            id: 'client-2',
            redwoodDonorId: 'RW-2',
            redwoodSyncStatus: 'synced',
            redwoodClientUpdateStatus: 'queued',
            redwoodPendingSyncFields: ['lastName'],
          },
        ],
        hasNextPage: false,
      }),
      logger: {
        error: vi.fn(),
        info: vi.fn(),
      },
    } as unknown as Pick<Payload, 'find' | 'logger'>

    const result = await queueNightlyPendingClientUpdates(payloadMock)

    expect(result.scannedClients).toBe(2)
    expect(result.queuedClientIds).toEqual(['client-1'])
    expect(result.skippedClientIds).toEqual(['client-2'])
    expect(result.failedClientIds).toEqual([])
    expect(queueRedwoodClientUpdate).toHaveBeenCalledWith('client-1', ['phone'], undefined, payloadMock)
  })

  it('skips clients with no Redwood linkage or no pending fields', async () => {
    const payloadMock = {
      find: vi.fn().mockResolvedValue({
        docs: [
          {
            id: 'client-1',
            redwoodSyncStatus: 'not-queued',
            redwoodDonorId: '',
            redwoodPendingSyncFields: ['phone'],
          },
          {
            id: 'client-2',
            redwoodSyncStatus: 'synced',
            redwoodDonorId: 'RW-2',
            redwoodPendingSyncFields: [],
          },
        ],
        hasNextPage: false,
      }),
      logger: {
        error: vi.fn(),
        info: vi.fn(),
      },
    } as unknown as Pick<Payload, 'find' | 'logger'>

    const result = await queueNightlyPendingClientUpdates(payloadMock)

    expect(result.queuedClientIds).toEqual([])
    expect(result.skippedClientIds).toEqual(['client-1', 'client-2'])
    expect(queueRedwoodClientUpdate).not.toHaveBeenCalled()
  })
})
