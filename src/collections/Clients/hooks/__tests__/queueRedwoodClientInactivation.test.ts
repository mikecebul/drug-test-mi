import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/redwood/queue', () => ({
  queueRedwoodClientInactivation: vi.fn().mockResolvedValue({ jobId: 'job-inactivate-1' }),
}))

import { REDWOOD_SKIP_INACTIVATION_QUEUE_CONTEXT_KEY } from '@/lib/redwood/context'
import { queueRedwoodClientInactivation } from '@/lib/redwood/queue'
import { queueRedwoodClientInactivationAfterChange } from '../queueRedwoodClientInactivation'

describe('queueRedwoodClientInactivationAfterChange', () => {
  beforeEach(() => {
    vi.mocked(queueRedwoodClientInactivation).mockClear()
  })

  it('queues Redwood inactivation when a Redwood-ready client is marked inactive', async () => {
    const payloadMock: any = {
      logger: {
        error: vi.fn(),
        info: vi.fn(),
      },
    }

    await queueRedwoodClientInactivationAfterChange({
      collection: {} as any,
      context: {},
      data: {},
      doc: {
        id: 'client-1',
        isActive: false,
        redwoodDonorId: '2714034',
        redwoodSyncStatus: 'synced',
      },
      operation: 'update',
      previousDoc: {
        isActive: true,
      },
      req: {
        context: {},
        payload: payloadMock,
        user: {
          collection: 'admins',
          id: 'admin-1',
        },
      } as any,
    })

    expect(queueRedwoodClientInactivation).toHaveBeenCalledWith(
      'client-1',
      'admin-1',
      payloadMock,
      expect.anything(),
    )
  })

  it('skips when the client is not Redwood-ready', async () => {
    const payloadMock: any = {
      logger: {
        error: vi.fn(),
        info: vi.fn(),
      },
    }

    await queueRedwoodClientInactivationAfterChange({
      collection: {} as any,
      context: {},
      data: {},
      doc: {
        id: 'client-1',
        isActive: false,
        redwoodSyncStatus: 'queued',
      },
      operation: 'update',
      previousDoc: {
        isActive: true,
      },
      req: {
        context: {},
        payload: payloadMock,
      } as any,
    })

    expect(queueRedwoodClientInactivation).not.toHaveBeenCalled()
    expect(payloadMock.logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        msg: '[clients] Skipped auto-queueing Redwood inactivation because client is not Redwood-ready yet',
      }),
    )
  })

  it('skips when inactivation was updated by the inactivation job', async () => {
    await queueRedwoodClientInactivationAfterChange({
      collection: {} as any,
      context: {},
      data: {},
      doc: {
        id: 'client-1',
        isActive: false,
        redwoodDonorId: '2714034',
        redwoodSyncStatus: 'synced',
      },
      operation: 'update',
      previousDoc: {
        isActive: true,
      },
      req: {
        context: {
          [REDWOOD_SKIP_INACTIVATION_QUEUE_CONTEXT_KEY]: true,
        },
        payload: {
          logger: {
            error: vi.fn(),
            info: vi.fn(),
          },
        },
      } as any,
    })

    expect(queueRedwoodClientInactivation).not.toHaveBeenCalled()
  })
})
