import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getPayload } from 'payload'
import { headers } from 'next/headers'

import { clearPendingRedwoodClientSync } from './clearPendingRedwoodClientSync'

vi.mock('payload', () => ({
  getPayload: vi.fn(),
}))

vi.mock('@payload-config', () => ({
  default: {},
}))

vi.mock('next/headers', () => ({
  headers: vi.fn(),
}))

type MockPayload = {
  auth: ReturnType<typeof vi.fn>
  findByID: ReturnType<typeof vi.fn>
  logger: {
    error: ReturnType<typeof vi.fn>
  }
  update: ReturnType<typeof vi.fn>
}

describe('clearPendingRedwoodClientSync', () => {
  let payloadMock: MockPayload

  beforeEach(() => {
    vi.clearAllMocks()

    payloadMock = {
      auth: vi.fn(),
      findByID: vi.fn(),
      logger: {
        error: vi.fn(),
      },
      update: vi.fn(),
    }

    vi.mocked(getPayload).mockResolvedValue(payloadMock as unknown as Awaited<ReturnType<typeof getPayload>>)
    vi.mocked(headers).mockResolvedValue(new Headers() as unknown as Awaited<ReturnType<typeof headers>>)
    payloadMock.auth.mockResolvedValue({
      user: { id: 'admin-1', collection: 'admins' },
    })
  })

  it('does not clear pending Redwood state while a client update job is queued', async () => {
    payloadMock.findByID.mockResolvedValue({
      id: 'client-1',
      redwoodSyncStatus: 'synced',
      redwoodClientUpdateStatus: 'queued',
      redwoodPendingSyncFields: ['phone'],
    })

    const result = await clearPendingRedwoodClientSync('client-1')

    expect(result).toEqual({
      success: false,
      error: 'A Redwood client sync is already queued for this client.',
    })
    expect(payloadMock.update).not.toHaveBeenCalled()
  })

  it('clears pending Redwood fields and resets the client update status', async () => {
    payloadMock.findByID.mockResolvedValue({
      id: 'client-1',
      redwoodDonorId: 'RW-1',
      redwoodSyncStatus: 'synced',
      redwoodClientUpdateStatus: 'failed',
      redwoodPendingSyncFields: ['phone', 'lastName'],
    })

    const result = await clearPendingRedwoodClientSync('client-1')

    expect(result).toEqual({
      success: true,
      clearedFields: ['lastName', 'phone'],
    })
    expect(payloadMock.update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'clients',
        id: 'client-1',
        data: expect.objectContaining({
          redwoodClientUpdateLastError: null,
          redwoodClientUpdateStatus: 'synced',
          redwoodPendingSyncFields: [],
        }),
      }),
    )
  })
})
