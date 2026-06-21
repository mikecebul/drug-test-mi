import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getPayload } from 'payload'
import { headers } from 'next/headers'

import { queueRedwoodClientUpdate } from '@/lib/redwood/queue'
import { queuePendingRedwoodClientSync } from './queuePendingRedwoodClientSync'

vi.mock('payload', () => ({
  getPayload: vi.fn(),
}))

vi.mock('@payload-config', () => ({
  default: {},
}))

vi.mock('next/headers', () => ({
  headers: vi.fn(),
}))

vi.mock('@/lib/redwood/queue', () => ({
  queueRedwoodClientUpdate: vi.fn().mockResolvedValue({ jobId: 'job-1' }),
}))

type MockPayload = {
  auth: ReturnType<typeof vi.fn>
  findByID: ReturnType<typeof vi.fn>
  logger: {
    error: ReturnType<typeof vi.fn>
  }
}

describe('queuePendingRedwoodClientSync', () => {
  let payloadMock: MockPayload

  beforeEach(() => {
    vi.clearAllMocks()

    payloadMock = {
      auth: vi.fn(),
      findByID: vi.fn(),
      logger: {
        error: vi.fn(),
      },
    }

    vi.mocked(getPayload).mockResolvedValue(payloadMock as unknown as Awaited<ReturnType<typeof getPayload>>)
    vi.mocked(headers).mockResolvedValue(new Headers() as unknown as Awaited<ReturnType<typeof headers>>)
    payloadMock.auth.mockResolvedValue({
      user: { id: 'admin-1', collection: 'admins' },
    })
  })

  it('does not queue another Redwood sync when one is already queued', async () => {
    payloadMock.findByID.mockResolvedValue({
      id: 'client-1',
      redwoodDonorId: 'RW-1',
      redwoodSyncStatus: 'synced',
      redwoodClientUpdateStatus: 'queued',
      redwoodPendingSyncFields: ['phone'],
    })

    const result = await queuePendingRedwoodClientSync('client-1')

    expect(result).toEqual({
      success: false,
      error: 'A Redwood client sync is already queued for this client.',
    })
    expect(queueRedwoodClientUpdate).not.toHaveBeenCalled()
  })

  it('queues the pending Redwood fields when no active Redwood update job exists', async () => {
    payloadMock.findByID.mockResolvedValue({
      id: 'client-1',
      redwoodDonorId: 'RW-1',
      redwoodSyncStatus: 'synced',
      redwoodClientUpdateStatus: 'failed',
      redwoodPendingSyncFields: ['phone', 'lastName'],
    })

    const result = await queuePendingRedwoodClientSync('client-1')

    expect(result).toEqual({
      success: true,
      jobId: 'job-1',
    })
    expect(queueRedwoodClientUpdate).toHaveBeenCalledWith('client-1', ['lastName', 'phone'], 'admin-1', payloadMock)
  })
})
