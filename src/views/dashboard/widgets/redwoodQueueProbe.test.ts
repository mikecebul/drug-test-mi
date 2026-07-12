import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getPayload } from 'payload'
import { headers } from 'next/headers'

import { recordQueuedJobRun } from '@/lib/jobs/jobRuns'
import { getRedwoodAutomationRuntimeState } from '@/lib/redwood/config'
import { getRedwoodQueueProbeStatus, queueRedwoodQueueProbe } from './redwoodQueueProbe'

vi.mock('payload', () => ({
  getPayload: vi.fn(),
}))

vi.mock('@payload-config', () => ({
  default: {},
}))

vi.mock('next/headers', () => ({
  headers: vi.fn(),
}))

vi.mock('node:crypto', () => ({
  randomUUID: vi.fn(() => 'probe-uuid'),
}))

vi.mock('node:os', () => ({
  hostname: vi.fn(() => 'website-container'),
}))

vi.mock('@/lib/jobs/jobRuns', () => ({
  JOB_RUNS_COLLECTION_SLUG: 'job-runs',
  recordQueuedJobRun: vi.fn(),
}))

vi.mock('@/lib/redwood/config', () => ({
  getRedwoodAutomationRuntimeState: vi.fn(),
}))

type MockPayload = {
  auth: ReturnType<typeof vi.fn>
  find: ReturnType<typeof vi.fn>
  findByID: ReturnType<typeof vi.fn>
  jobs: {
    queue: ReturnType<typeof vi.fn>
  }
  logger: {
    error: ReturnType<typeof vi.fn>
    info: ReturnType<typeof vi.fn>
  }
}

describe('Redwood dashboard queue probe', () => {
  let payloadMock: MockPayload

  beforeEach(() => {
    vi.clearAllMocks()

    payloadMock = {
      auth: vi.fn().mockResolvedValue({
        user: { id: 'admin-1', collection: 'admins' },
      }),
      find: vi.fn(),
      findByID: vi.fn(),
      jobs: {
        queue: vi.fn().mockResolvedValue({ id: 'job-1' }),
      },
      logger: {
        error: vi.fn(),
        info: vi.fn(),
      },
    }

    vi.mocked(getPayload).mockResolvedValue(payloadMock as unknown as Awaited<ReturnType<typeof getPayload>>)
    vi.mocked(headers).mockResolvedValue(new Headers() as unknown as Awaited<ReturnType<typeof headers>>)
    vi.mocked(getRedwoodAutomationRuntimeState).mockReturnValue({
      accountAllowed: true,
      configured: true,
      configuredValue: 'true',
      credentialsConfigured: true,
      enabled: true,
      missingEnvironmentVariables: [],
      nodeEnv: 'production',
      ready: true,
    })
  })

  it('queues a harmless diagnostic task on the Redwood worker queue', async () => {
    const result = await queueRedwoodQueueProbe()

    expect(result).toEqual({
      automationConfigured: true,
      automationConfiguredValue: 'true',
      automationEnabled: true,
      jobId: 'job-1',
      nodeEnv: 'production',
      phase: 'queued',
      probeId: 'probe-uuid',
      success: true,
      webHostname: 'website-container',
      webMissingEnvironmentVariables: [],
      webRuntimeReady: true,
    })
    expect(payloadMock.jobs.queue).toHaveBeenCalledWith({
      input: {
        probeId: 'probe-uuid',
        requestedByAdminId: 'admin-1',
        webHostname: 'website-container',
      },
      overrideAccess: true,
      queue: 'redwood',
      task: 'redwood-diagnostics-probe',
    })
    expect(recordQueuedJobRun).toHaveBeenCalledWith(
      payloadMock,
      expect.objectContaining({
        jobId: 'job-1',
        queue: 'redwood',
        taskSlug: 'redwood-diagnostics-probe',
      }),
    )
    expect(payloadMock.logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: 'job-1',
        msg: '[redwood-diagnostics] Queue probe created by website',
      }),
    )
  })

  it('does not queue when the caller is not an admin', async () => {
    payloadMock.auth.mockResolvedValue({ user: null })

    const result = await queueRedwoodQueueProbe()

    expect(result).toEqual({
      success: false,
      error: 'Unauthorized: admin access required.',
    })
    expect(payloadMock.jobs.queue).not.toHaveBeenCalled()
  })

  it('logs website-side queue failures', async () => {
    payloadMock.jobs.queue.mockRejectedValue(new Error('Mongo queue unavailable'))

    const result = await queueRedwoodQueueProbe()

    expect(result).toEqual({
      success: false,
      error: 'Mongo queue unavailable',
    })
    expect(payloadMock.logger.error).toHaveBeenCalledWith({
      msg: '[redwood-diagnostics] Website failed to queue probe',
      error: 'Mongo queue unavailable',
    })
  })

  it('reports worker completion details from durable Job History', async () => {
    payloadMock.find.mockResolvedValue({
      docs: [
        {
          inputSnapshot: {
            probeId: 'probe-uuid',
            webHostname: 'website-container',
          },
          outputSnapshot: {
            automationConfiguredValue: 'true',
            automationEnabled: true,
            missingEnvironmentVariables: '',
            processedAt: '2026-07-12T12:00:00.000Z',
            runtimeReady: true,
            workerHostname: 'worker-container',
          },
          status: 'succeeded',
          summary: 'Probe completed.',
        },
      ],
    })
    payloadMock.findByID.mockResolvedValue({ id: 'job-1' })

    const result = await getRedwoodQueueProbeStatus('job-1')

    expect(result).toEqual({
      automationConfigured: true,
      automationConfiguredValue: 'true',
      automationEnabled: true,
      jobId: 'job-1',
      nodeEnv: 'production',
      phase: 'succeeded',
      probeId: 'probe-uuid',
      processedAt: '2026-07-12T12:00:00.000Z',
      success: true,
      summary: 'Probe completed.',
      webHostname: 'website-container',
      webMissingEnvironmentVariables: [],
      webRuntimeReady: true,
      workerAutomationConfiguredValue: 'true',
      workerAutomationEnabled: true,
      workerHostname: 'worker-container',
      workerMissingEnvironmentVariables: [],
      workerRuntimeReady: true,
    })
  })

  it('falls back to the Payload job when Job History is unavailable', async () => {
    payloadMock.find.mockResolvedValue({ docs: [] })
    payloadMock.findByID.mockResolvedValue({
      id: 'job-1',
      completedAt: null,
      hasError: false,
      processing: true,
    })

    const result = await getRedwoodQueueProbeStatus('job-1')

    expect(result).toEqual({
      automationConfigured: true,
      automationConfiguredValue: 'true',
      automationEnabled: true,
      jobId: 'job-1',
      nodeEnv: 'production',
      phase: 'running',
      success: true,
      summary: 'Payload job exists, but no durable Job History row was found.',
      webMissingEnvironmentVariables: [],
      webRuntimeReady: true,
    })
  })
})
