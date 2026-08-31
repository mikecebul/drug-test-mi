import type { Payload } from 'payload'
import { beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getPayload: vi.fn(),
  recordRedwoodWorkerHeartbeat: vi.fn(),
}))

vi.mock('payload', async (importOriginal) => ({
  ...(await importOriginal<typeof import('payload')>()),
  getPayload: mocks.getPayload,
}))

vi.mock('@/lib/health/redwoodWorkerHeartbeat', () => ({
  recordRedwoodWorkerHeartbeat: mocks.recordRedwoodWorkerHeartbeat,
}))

import { runRedwoodQueueBatch, runRedwoodWorkerCycle, script } from './worker'

function createPayload(run: ReturnType<typeof vi.fn>, handleSchedules = vi.fn().mockResolvedValue({})) {
  return {
    jobs: {
      handleSchedules,
      run,
    },
    logger: {
      error: vi.fn(),
    },
  } as unknown as Payload
}

describe('Redwood queue worker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('records a heartbeat only after a protected cron tick completes', async () => {
    const run = vi.fn().mockResolvedValue({ noJobsRemaining: true, remainingJobsFromQueried: 0 })
    const payload = createPayload(run)
    mocks.getPayload.mockResolvedValue(payload)

    await script({} as Parameters<typeof script>[0])

    expect(run).toHaveBeenCalledOnce()
    expect(mocks.recordRedwoodWorkerHeartbeat).toHaveBeenCalledOnce()
  })

  test('does not advance the heartbeat when the queue query fails', async () => {
    const run = vi.fn().mockRejectedValue(new Error('database unavailable'))
    const payload = createPayload(run)
    mocks.getPayload.mockResolvedValue(payload)

    await script({} as Parameters<typeof script>[0])

    expect(mocks.recordRedwoodWorkerHeartbeat).not.toHaveBeenCalled()
    expect(payload.logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        msg: expect.stringContaining('next Payload cron tick'),
      }),
    )
  })

  test('runs at most one bounded batch per tick even when Payload reports completed work', async () => {
    const run = vi.fn().mockResolvedValue({
      jobStatus: { donor: { status: 'success' } },
      remainingJobsFromQueried: 0,
    })

    const result = await runRedwoodQueueBatch(createPayload(run), 3)

    expect(result).toEqual({ retryNeedsBackoff: false, runs: 1 })
    expect(run).toHaveBeenCalledOnce()
    expect(run).toHaveBeenCalledWith({
      limit: 3,
      overrideAccess: true,
      queue: 'redwood',
    })
  })

  test('returns to the idle interval before retrying a failed external request', async () => {
    const run = vi.fn().mockResolvedValue({
      jobStatus: { donor: { status: 'error' } },
      remainingJobsFromQueried: 1,
    })

    const result = await runRedwoodQueueBatch(createPayload(run), 3)

    expect(result).toEqual({ retryNeedsBackoff: true, runs: 1 })
    expect(run).toHaveBeenCalledTimes(1)
  })

  test('reports an idle tick without running another query', async () => {
    const run = vi.fn().mockResolvedValue({ noJobsRemaining: true, remainingJobsFromQueried: 0 })

    const result = await runRedwoodQueueBatch(createPayload(run), 3)

    expect(result).toEqual({ retryNeedsBackoff: false, runs: 0 })
    expect(run).toHaveBeenCalledOnce()
  })

  test('handles recurring schedules before draining the same queue', async () => {
    const handleSchedules = vi.fn().mockResolvedValue({ errored: [], queued: [], skipped: [] })
    const run = vi.fn().mockResolvedValue({ noJobsRemaining: true, remainingJobsFromQueried: 0 })

    await runRedwoodWorkerCycle(createPayload(run, handleSchedules), 3)

    expect(handleSchedules).toHaveBeenCalledWith({ queue: 'redwood' })
    expect(handleSchedules.mock.invocationCallOrder[0]).toBeLessThan(run.mock.invocationCallOrder[0])
  })

  test('still drains queued work when a schedule check fails', async () => {
    const handleSchedules = vi.fn().mockRejectedValue(new Error('schedule stats unavailable'))
    const run = vi.fn().mockResolvedValue({ noJobsRemaining: true, remainingJobsFromQueried: 0 })
    const payload = createPayload(run, handleSchedules)

    await runRedwoodWorkerCycle(payload, 3)

    expect(run).toHaveBeenCalledTimes(1)
    expect(payload.logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        msg: expect.stringContaining('continuing with queued work'),
      }),
    )
  })
})
