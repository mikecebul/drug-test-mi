import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/redwood/incidents', () => ({
  upsertRedwoodIncidentAlert: vi.fn().mockResolvedValue(undefined),
}))

import {
  queueRedwoodClientUpdate,
  queueRedwoodDefaultTestSync,
  queueRedwoodHeadshotSync,
  queueRedwoodHeadshotUpload,
  queueRedwoodImportForClient,
  queueRedwoodUniqueIdBackfill,
} from '@/lib/redwood/queue'

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
      findByID: vi.fn().mockResolvedValue({
        id: 'client-2',
      }),
      update: vi.fn().mockResolvedValue({ id: 'client-2' }),
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
    expect(payloadMock.update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'clients',
        id: 'client-2',
        data: expect.objectContaining({
          redwoodHeadshotSyncStatus: 'queued',
        }),
      }),
    )
  })

  it('queues batched client update jobs in the redwood queue', async () => {
    const payloadMock: any = {
      update: vi.fn().mockResolvedValue({ id: 'client-2' }),
      jobs: {
        queue: vi.fn().mockResolvedValue({ id: 'job-update-1' }),
      },
      logger: {
        info: vi.fn(),
      },
    }

    const result = await queueRedwoodClientUpdate('client-2', ['phone', 'lastName', 'phone'], 'admin-1', payloadMock)

    expect(result.jobId).toBe('job-update-1')
    expect(payloadMock.jobs.queue).toHaveBeenCalledWith(
      expect.objectContaining({
        task: 'redwood-update-client',
        queue: 'redwood',
        input: {
          clientId: 'client-2',
          changedFieldsCsv: 'lastName,phone',
          requestedByAdminId: 'admin-1',
        },
      }),
    )
    expect(payloadMock.update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'clients',
        id: 'client-2',
        data: expect.objectContaining({
          redwoodClientUpdateStatus: 'queued',
        }),
      }),
    )
  })

  it('queues unique ID backfill jobs in the redwood queue', async () => {
    const payloadMock: any = {
      findByID: vi.fn().mockResolvedValue({
        id: 'client-3',
        redwoodUniqueId: '',
      }),
      update: vi.fn().mockResolvedValue({ id: 'client-3' }),
      jobs: {
        queue: vi.fn().mockResolvedValue({ id: 'job-3' }),
      },
      logger: {
        info: vi.fn(),
      },
    }

    const result = await queueRedwoodUniqueIdBackfill('client-3', 'admin-2', payloadMock)

    expect(result.jobId).toBe('job-3')
    expect(payloadMock.jobs.queue).toHaveBeenCalledWith(
      expect.objectContaining({
        task: 'redwood-backfill-client-unique-id',
        queue: 'redwood',
      }),
    )
    expect(payloadMock.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          redwoodUniqueIdSyncStatus: 'queued',
        }),
      }),
    )
  })

  it('does not queue website-to-Redwood headshot upload without Redwood identity', async () => {
    const payloadMock: any = {
      findByID: vi.fn().mockResolvedValue({
        id: 'client-4',
        redwoodUniqueId: '',
        redwoodDonorId: '',
        headshot: 'media-1',
      }),
      update: vi.fn().mockResolvedValue({ id: 'client-4' }),
      jobs: {
        queue: vi.fn(),
      },
      logger: {
        info: vi.fn(),
      },
    }

    await expect(queueRedwoodHeadshotUpload('client-4', 'admin-3', payloadMock)).rejects.toThrow(
      'missing Redwood identity',
    )
    expect(payloadMock.jobs.queue).not.toHaveBeenCalled()
    expect(payloadMock.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          redwoodHeadshotPushStatus: 'failed',
        }),
      }),
    )
  })

  it('queues website-to-Redwood headshot upload when donorId exists without unique ID', async () => {
    const payloadMock: any = {
      findByID: vi.fn().mockResolvedValue({
        id: 'client-5',
        redwoodUniqueId: '',
        redwoodDonorId: '2714034',
        headshot: 'media-2',
      }),
      update: vi.fn().mockResolvedValue({ id: 'client-5' }),
      jobs: {
        queue: vi.fn().mockResolvedValue({ id: 'job-5' }),
      },
      logger: {
        info: vi.fn(),
      },
    }

    const result = await queueRedwoodHeadshotUpload('client-5', 'admin-4', payloadMock)

    expect(result.jobId).toBe('job-5')
    expect(payloadMock.jobs.queue).toHaveBeenCalledWith(
      expect.objectContaining({
        task: 'redwood-upload-headshot',
        queue: 'redwood',
        input: {
          clientId: 'client-5',
          requestedByAdminId: 'admin-4',
        },
      }),
    )
  })

  it('queues Redwood default-test sync jobs in the redwood queue', async () => {
    const payloadMock: any = {
      jobs: {
        queue: vi.fn().mockResolvedValue({ id: 'job-default-test-1' }),
      },
      logger: {
        info: vi.fn(),
      },
    }

    const result = await queueRedwoodDefaultTestSync('client-7', payloadMock)

    expect(result.jobId).toBe('job-default-test-1')
    expect(payloadMock.jobs.queue).toHaveBeenCalledWith(
      expect.objectContaining({
        task: 'redwood-sync-default-test',
        queue: 'redwood',
        input: {
          clientId: 'client-7',
        },
      }),
    )
  })
})
