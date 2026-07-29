import type { Payload } from 'payload'
import { describe, expect, test, vi } from 'vitest'

import { drainRedwoodQueue } from './worker'

function createPayload(run: ReturnType<typeof vi.fn>) {
  return {
    jobs: {
      run,
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
})
