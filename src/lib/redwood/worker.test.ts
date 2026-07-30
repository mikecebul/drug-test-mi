import type { Payload } from 'payload'
import { describe, expect, test, vi } from 'vitest'

import { drainRedwoodQueue, runRedwoodWorkerCycle } from './worker'

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
  test('drains follow-up jobs without waiting for another idle poll', async () => {
    const run = vi
      .fn()
      .mockResolvedValueOnce({ jobStatus: { donor: { status: 'success' } }, remainingJobsFromQueried: 0 })
      .mockResolvedValueOnce({ jobStatus: { defaultTest: { status: 'success' } }, remainingJobsFromQueried: 0 })
      .mockResolvedValueOnce({ noJobsRemaining: true, remainingJobsFromQueried: 0 })

    const result = await drainRedwoodQueue(createPayload(run), 3)

    expect(result).toEqual({ retryNeedsBackoff: false, runs: 2 })
    expect(run).toHaveBeenCalledTimes(3)
    expect(run).toHaveBeenNthCalledWith(1, {
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

    const result = await drainRedwoodQueue(createPayload(run), 3)

    expect(result).toEqual({ retryNeedsBackoff: true, runs: 1 })
    expect(run).toHaveBeenCalledTimes(1)
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
