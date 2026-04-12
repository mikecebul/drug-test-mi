import { describe, expect, it, vi } from 'vitest'

import { recordCancelledJobRun, recordCompletedJobRun, recordQueuedJobRun } from '@/lib/jobs/jobRuns'

type PayloadArg = Parameters<typeof recordQueuedJobRun>[0]
type CompletedJobArg = Parameters<typeof recordCompletedJobRun>[1]['job']

type PayloadMock = {
  create: ReturnType<typeof vi.fn>
  find: ReturnType<typeof vi.fn>
  logger: {
    error: ReturnType<typeof vi.fn>
  }
  update: ReturnType<typeof vi.fn>
}

describe('job run history helpers', () => {
  it('creates a queued history record for tracked jobs', async () => {
    const payloadMock: PayloadMock = {
      create: vi.fn().mockResolvedValue({ id: 'history-1' }),
      find: vi.fn().mockResolvedValue({ docs: [] }),
      logger: {
        error: vi.fn(),
      },
      update: vi.fn(),
    }

    await recordQueuedJobRun(payloadMock as unknown as PayloadArg, {
      jobId: 'job-1',
      queue: 'redwood',
      taskSlug: 'redwood-update-client',
      input: {
        changedFieldsCsv: 'phone',
        clientId: 'client-1',
        requestedByAdminId: 'admin-1',
      },
    })

    expect(payloadMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'job-runs',
        data: expect.objectContaining({
          changedFieldsCsv: 'phone',
          client: 'client-1',
          jobId: 'job-1',
          queue: 'redwood',
          requestedByAdmin: 'admin-1',
          status: 'queued',
          taskLabel: 'Client Sync',
          taskSlug: 'redwood-update-client',
        }),
      }),
    )
  })

  it('updates an existing history record when a job completes', async () => {
    const payloadMock: PayloadMock = {
      create: vi.fn(),
      find: vi.fn().mockResolvedValue({
        docs: [
          {
            createdAt: '2026-03-09T00:00:00.000Z',
            id: 'history-1',
            jobId: 'job-1',
            queue: 'redwood',
            status: 'queued',
            taskLabel: 'Client Sync',
            taskSlug: 'redwood-update-client',
            updatedAt: '2026-03-09T00:00:00.000Z',
          },
        ],
      }),
      logger: {
        error: vi.fn(),
      },
      update: vi.fn().mockResolvedValue({ id: 'history-1' }),
    }

    const job: CompletedJobArg = {
      id: 'job-1',
      input: {
        clientId: 'client-1',
      },
      queue: 'redwood',
      taskSlug: 'redwood-update-client',
      totalTried: 2,
    } as CompletedJobArg

    await recordCompletedJobRun(payloadMock as unknown as PayloadArg, {
      job,
      output: {
        status: 'synced',
      },
      resultStatus: 'synced',
      status: 'succeeded',
    })

    expect(payloadMock.update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'job-runs',
        id: 'history-1',
        data: expect.objectContaining({
          attemptCount: 2,
          client: 'client-1',
          resultStatus: 'synced',
          status: 'succeeded',
        }),
      }),
    )
  })

  it('records cancellation using the existing history row when available', async () => {
    const payloadMock: PayloadMock = {
      create: vi.fn(),
      find: vi.fn().mockResolvedValue({
        docs: [
          {
            changedFieldsCsv: 'phone',
            client: 'client-1',
            createdAt: '2026-03-09T00:00:00.000Z',
            id: 'history-1',
            jobId: 'job-1',
            queue: 'redwood',
            requestedByAdmin: 'admin-1',
            source: null,
            status: 'queued',
            taskLabel: 'Client Sync',
            taskSlug: 'redwood-update-client',
            updatedAt: '2026-03-09T00:00:00.000Z',
          },
        ],
      }),
      logger: {
        error: vi.fn(),
      },
      update: vi.fn().mockResolvedValue({ id: 'history-1' }),
    }

    await recordCancelledJobRun(payloadMock as unknown as PayloadArg, {
      cancelledByAdminId: 'admin-9',
      jobId: 'job-1',
    })

    expect(payloadMock.update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'job-runs',
        id: 'history-1',
        data: expect.objectContaining({
          cancelledByAdmin: 'admin-9',
          resultStatus: 'cancelled',
          status: 'cancelled',
        }),
      }),
    )
  })
})
