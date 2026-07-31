import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getPayload: vi.fn(),
  headers: vi.fn(),
  retryFailedJobRun: vi.fn(),
}))

vi.mock('@payload-config', () => ({ default: Promise.resolve({}) }))
vi.mock('next/headers', () => ({ headers: mocks.headers }))
vi.mock('payload', () => ({ getPayload: mocks.getPayload }))
vi.mock('@/lib/jobs/retryFailedJobRun', () => ({
  retryFailedJobRun: mocks.retryFailedJobRun,
}))

import { retryJobRunAction } from './retryJobRunAction'

function createPayloadMock(user: Record<string, unknown> | null) {
  return {
    auth: vi.fn().mockResolvedValue({ user }),
    logger: {
      error: vi.fn(),
    },
  }
}

describe('retryJobRunAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.headers.mockResolvedValue(new Headers())
  })

  it('requires a super-admin even when an admin can read Job History', async () => {
    mocks.getPayload.mockResolvedValue(
      createPayloadMock({
        collection: 'admins',
        id: 'admin-1',
        role: 'admin',
      }),
    )

    await expect(retryJobRunAction('history-1')).resolves.toEqual({
      success: false,
      error: 'Unauthorized: super-admin access required to retry jobs.',
    })
    expect(mocks.retryFailedJobRun).not.toHaveBeenCalled()
  })

  it('queues a retry for an authenticated super-admin', async () => {
    const payload = createPayloadMock({
      collection: 'admins',
      id: 'super-1',
      role: 'superAdmin',
    })
    mocks.getPayload.mockResolvedValue(payload)
    mocks.retryFailedJobRun.mockResolvedValue({
      deduplicated: false,
      jobId: 'retry-job-2',
      taskLabel: 'Redwood Import',
    })

    await expect(retryJobRunAction('history-1')).resolves.toEqual({
      success: true,
      deduplicated: false,
      jobId: 'retry-job-2',
      taskLabel: 'Redwood Import',
    })
    expect(mocks.retryFailedJobRun).toHaveBeenCalledWith({
      jobRunId: 'history-1',
      payload,
      requestedByAdminId: 'super-1',
    })
  })
})
