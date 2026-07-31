import { ValidationError } from 'payload'
import { describe, expect, it, vi } from 'vitest'

import {
  recordCancelledJobRun,
  recordCompletedJobRun,
  recordQueuedJobRun,
  recordRunningJobRun,
} from '@/lib/jobs/jobRuns'

type PayloadArg = Parameters<typeof recordQueuedJobRun>[0]
type CompletedJobArg = Parameters<typeof recordCompletedJobRun>[1]['job']

type PayloadMock = {
  db: {
    updateOne: ReturnType<typeof vi.fn>
    upsert: ReturnType<typeof vi.fn>
  }
  find: ReturnType<typeof vi.fn>
  logger: {
    error: ReturnType<typeof vi.fn>
  }
}

function createPayloadMock(): PayloadMock {
  return {
    db: {
      updateOne: vi.fn().mockResolvedValue(null),
      upsert: vi.fn().mockResolvedValue(null),
    },
    find: vi.fn().mockResolvedValue({ docs: [] }),
    logger: {
      error: vi.fn(),
    },
  }
}

function createJobIdUniqueError(): ValidationError {
  return new ValidationError({
    collection: 'job-runs',
    errors: [{ message: 'Value must be unique', path: 'jobId' }],
  })
}

describe('job run history helpers', () => {
  it('atomically upserts a queued history record for tracked jobs', async () => {
    const payloadMock = createPayloadMock()

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

    expect(payloadMock.db.upsert).toHaveBeenCalledWith(
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
        where: {
          and: [{ jobId: { equals: 'job-1' } }, { status: { in: ['queued'] } }],
        },
      }),
    )
  })

  it('records the admin who manually retried a queued job', async () => {
    const payloadMock = createPayloadMock()

    await recordQueuedJobRun(payloadMock as unknown as PayloadArg, {
      input: {
        clientId: 'client-1',
        requestedByAdminId: 'original-admin',
      },
      jobId: 'job-retry',
      requestedByAdminId: 'retrying-admin',
      taskSlug: 'redwood-update-client',
    })

    expect(payloadMock.db.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          requestedByAdmin: 'retrying-admin',
        }),
      }),
    )
  })

  it('does not regress a later lifecycle state when queued persistence loses the insert race', async () => {
    const payloadMock = createPayloadMock()
    payloadMock.db.upsert.mockRejectedValueOnce(createJobIdUniqueError())

    await recordQueuedJobRun(payloadMock as unknown as PayloadArg, {
      jobId: 'job-1',
      queue: 'redwood',
      taskSlug: 'redwood-import-client',
      input: { clientId: 'client-1', source: 'registration' },
    })

    expect(payloadMock.db.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          and: [{ jobId: { equals: 'job-1' } }, { status: { in: ['queued'] } }],
        },
      }),
    )
    expect(payloadMock.logger.error).not.toHaveBeenCalled()
  })

  it('advances a concurrently inserted queued record to running after a unique-key race', async () => {
    const payloadMock = createPayloadMock()
    payloadMock.db.upsert.mockRejectedValueOnce(createJobIdUniqueError())

    await recordRunningJobRun(payloadMock as unknown as PayloadArg, {
      id: 'job-1',
      input: { clientId: 'client-1' },
      queue: 'redwood',
      taskSlug: 'redwood-import-client',
      totalTried: 1,
    })

    expect(payloadMock.db.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'running' }),
        where: {
          and: [{ jobId: { equals: 'job-1' } }, { status: { in: ['failed', 'queued', 'running'] } }],
        },
      }),
    )
  })

  it('atomically updates an existing history record when a job completes', async () => {
    const payloadMock = createPayloadMock()
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

    expect(payloadMock.db.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'job-runs',
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
    const payloadMock = createPayloadMock()
    payloadMock.find.mockResolvedValue({
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
    })

    await recordCancelledJobRun(payloadMock as unknown as PayloadArg, {
      cancelledByAdminId: 'admin-9',
      jobId: 'job-1',
    })

    expect(payloadMock.db.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'job-runs',
        data: expect.objectContaining({
          cancelledByAdmin: 'admin-9',
          resultStatus: 'cancelled',
          status: 'cancelled',
        }),
      }),
    )
  })
})
