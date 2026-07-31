import type { Payload } from 'payload'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getRandomTestingSyncRuntimeState: vi.fn(() => ({ configured: true, enabled: true, missing: [] })),
  getRedwoodAutomationRuntimeState: vi.fn(() => ({ configured: true, enabled: true })),
  recordQueuedJobRun: vi.fn(),
}))

vi.mock('@/lib/random-testing/runtime', () => ({
  getRandomTestingSyncRuntimeState: mocks.getRandomTestingSyncRuntimeState,
}))

vi.mock('@/lib/redwood/config', () => ({
  getRedwoodAutomationRuntimeState: mocks.getRedwoodAutomationRuntimeState,
}))

vi.mock('../jobRuns', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../jobRuns')>()
  return {
    ...actual,
    recordQueuedJobRun: mocks.recordQueuedJobRun,
  }
})

import { retryFailedJobRun } from '../retryFailedJobRun'

function failedJobRun(overrides: Record<string, unknown> = {}) {
  return {
    id: 'history-1',
    createdAt: '2026-07-31T12:00:00.000Z',
    updatedAt: '2026-07-31T12:01:00.000Z',
    jobId: 'failed-job-1',
    taskSlug: 'redwood-import-client',
    taskLabel: 'Redwood Import',
    queue: 'redwood',
    status: 'failed',
    inputSnapshot: {
      clientId: 'client-1',
      source: 'frontend-registration',
    },
    ...overrides,
  }
}

function createPayloadMock(options?: {
  activeJobs?: Record<string, unknown>[]
  jobRun?: Record<string, unknown>
  originalJob?: Record<string, unknown> | null
}) {
  return {
    findByID: vi.fn().mockImplementation(({ collection }: { collection: string }) => {
      if (collection === 'payload-jobs') {
        return Promise.resolve(options?.originalJob === undefined ? { hasError: true } : options.originalJob)
      }

      return Promise.resolve(options?.jobRun || failedJobRun())
    }),
    find: vi.fn().mockResolvedValue({ docs: options?.activeJobs || [] }),
    jobs: {
      queue: vi.fn().mockResolvedValue({ id: 'retry-job-2' }),
    },
  }
}

describe('retryFailedJobRun', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getRandomTestingSyncRuntimeState.mockReturnValue({ configured: true, enabled: true, missing: [] })
    mocks.getRedwoodAutomationRuntimeState.mockReturnValue({ configured: true, enabled: true })
  })

  it('queues a new donor import with manual source and retry audit metadata', async () => {
    const payload = createPayloadMock()

    const result = await retryFailedJobRun({
      jobRunId: 'history-1',
      payload: payload as unknown as Payload,
      requestedByAdminId: 'admin-1',
    })

    expect(result).toEqual({
      deduplicated: false,
      jobId: 'retry-job-2',
      taskLabel: 'Redwood Import',
    })
    expect(payload.jobs.queue).toHaveBeenCalledWith({
      task: 'redwood-import-client',
      queue: 'redwood',
      input: {
        clientId: 'client-1',
        source: 'manual',
      },
      meta: {
        retriedByAdminId: 'admin-1',
        retriedFromJobId: 'failed-job-1',
        retriedFromJobRunId: 'history-1',
      },
      overrideAccess: true,
    })
    expect(mocks.recordQueuedJobRun).toHaveBeenCalledWith(payload, {
      input: {
        clientId: 'client-1',
        source: 'manual',
      },
      jobId: 'retry-job-2',
      queue: 'redwood',
      requestedByAdminId: 'admin-1',
      summary: 'Retried failed Redwood Import job failed-job-1.',
      taskSlug: 'redwood-import-client',
    })
  })

  it('reuses an identical active retry instead of queueing a duplicate', async () => {
    const payload = createPayloadMock({
      activeJobs: [
        {
          id: 'already-queued',
          queue: 'redwood',
          input: {
            clientId: 'client-1',
            source: 'manual',
          },
          completedAt: null,
          hasError: false,
        },
      ],
    })

    await expect(
      retryFailedJobRun({
        jobRunId: 'history-1',
        payload: payload as unknown as Payload,
        requestedByAdminId: 'admin-1',
      }),
    ).resolves.toEqual({
      deduplicated: true,
      jobId: 'already-queued',
      taskLabel: 'Redwood Import',
    })

    expect(payload.jobs.queue).not.toHaveBeenCalled()
    expect(mocks.recordQueuedJobRun).not.toHaveBeenCalled()
  })

  it('rejects history records that are no longer failed', async () => {
    const payload = createPayloadMock({
      jobRun: failedJobRun({ status: 'succeeded' }),
    })

    await expect(
      retryFailedJobRun({
        jobRunId: 'history-1',
        payload: payload as unknown as Payload,
        requestedByAdminId: 'admin-1',
      }),
    ).rejects.toThrow('Only failed jobs can be retried.')

    expect(payload.find).not.toHaveBeenCalled()
    expect(payload.jobs.queue).not.toHaveBeenCalled()
  })

  it('does not duplicate a job while Payload is still handling automatic retries', async () => {
    const payload = createPayloadMock({
      originalJob: {
        hasError: false,
        processing: false,
      },
    })

    await expect(
      retryFailedJobRun({
        jobRunId: 'history-1',
        payload: payload as unknown as Payload,
        requestedByAdminId: 'admin-1',
      }),
    ).rejects.toThrow('Payload is still running or automatically retrying this job.')

    expect(payload.find).not.toHaveBeenCalled()
    expect(payload.jobs.queue).not.toHaveBeenCalled()
  })

  it('does not queue another failure while Redwood automation is disabled', async () => {
    mocks.getRedwoodAutomationRuntimeState.mockReturnValue({ configured: true, enabled: false })
    const payload = createPayloadMock()

    await expect(
      retryFailedJobRun({
        jobRunId: 'history-1',
        payload: payload as unknown as Payload,
        requestedByAdminId: 'admin-1',
      }),
    ).rejects.toThrow('Redwood automation is disabled. Enable it before retrying this job.')

    expect(payload.jobs.queue).not.toHaveBeenCalled()
  })

  it('rejects internal Payload tasks that are not on the retry allowlist', async () => {
    const payload = createPayloadMock({
      jobRun: failedJobRun({
        taskSlug: 'createCollectionExport',
        taskLabel: 'Collection Export',
      }),
    })

    await expect(
      retryFailedJobRun({
        jobRunId: 'history-1',
        payload: payload as unknown as Payload,
        requestedByAdminId: 'admin-1',
      }),
    ).rejects.toThrow('Collection Export cannot be retried from Job History.')
  })
})
