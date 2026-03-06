import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/admin-alerts', () => ({
  createAdminAlert: vi.fn().mockResolvedValue(undefined),
}))

import { queueRedwoodHeadshotSync, queueRedwoodImportForClient } from '@/lib/redwood/queue'

describe('redwood queue helpers', () => {
  it('queues import jobs in the redwood queue and marks client queued after queueing succeeds', async () => {
    const payloadMock: any = {
      findByID: vi.fn().mockResolvedValue({
        id: 'client-1',
        redwoodUniqueId: '',
      }),
      update: vi.fn().mockResolvedValue({ id: 'client-1' }),
      jobs: {
        queue: vi.fn().mockResolvedValue({ id: 'job-1' }),
      },
      logger: {
        info: vi.fn(),
      },
    }

    const result = await queueRedwoodImportForClient('client-1', 'frontend-registration', payloadMock)

    expect(result.jobId).toBe('job-1')
    expect(payloadMock.update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'clients',
        id: 'client-1',
        data: expect.objectContaining({ redwoodSyncStatus: 'queued' }),
      }),
    )
    expect(payloadMock.jobs.queue).toHaveBeenCalledWith(
      expect.objectContaining({
        task: 'redwood-import-client',
        queue: 'redwood',
        input: {
          clientId: 'client-1',
          source: 'frontend-registration',
        },
      }),
    )
    expect(payloadMock.jobs.queue.mock.invocationCallOrder[0]).toBeLessThan(payloadMock.update.mock.invocationCallOrder[0])
  })

  it('does not mark client queued if queueing fails', async () => {
    const payloadMock: any = {
      findByID: vi.fn().mockResolvedValue({
        id: 'client-1',
        redwoodUniqueId: '',
      }),
      update: vi.fn(),
      jobs: {
        queue: vi.fn().mockRejectedValue(new Error('queue unavailable')),
      },
      logger: {
        info: vi.fn(),
      },
    }

    await expect(queueRedwoodImportForClient('client-1', 'frontend-registration', payloadMock)).rejects.toThrow(
      'queue unavailable',
    )
    expect(payloadMock.update).not.toHaveBeenCalled()
  })

  it('queues headshot jobs in the redwood queue', async () => {
    const payloadMock: any = {
      jobs: {
        queue: vi.fn().mockResolvedValue({ id: 'job-2' }),
      },
      logger: {
        info: vi.fn(),
      },
    }

    const result = await queueRedwoodHeadshotSync('client-2', 'admin-1', payloadMock)

    expect(result.jobId).toBe('job-2')
    expect(payloadMock.jobs.queue).toHaveBeenCalledWith(
      expect.objectContaining({
        task: 'redwood-sync-headshot',
        queue: 'redwood',
        input: {
          clientId: 'client-2',
          requestedByAdminId: 'admin-1',
        },
      }),
    )
  })
})
