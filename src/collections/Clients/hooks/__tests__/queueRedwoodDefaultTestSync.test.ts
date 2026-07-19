import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/redwood/queue', () => ({
  queueRedwoodDefaultTestSync: vi.fn().mockResolvedValue({ jobId: 'job-default-test-1' }),
}))

import { queueRedwoodDefaultTestSync } from '@/lib/redwood/queue'
import { queueRedwoodDefaultTestSyncAfterChange } from '../queueRedwoodDefaultTestSync'

describe('queueRedwoodDefaultTestSyncAfterChange', () => {
  beforeEach(() => {
    vi.mocked(queueRedwoodDefaultTestSync).mockClear()
  })

  it('queues default-test sync when a Redwood-ready client default test changes', async () => {
    const payloadMock: any = {
      findByID: vi.fn(),
      logger: {
        error: vi.fn(),
        info: vi.fn(),
      },
    }

    await queueRedwoodDefaultTestSyncAfterChange({
      collection: {} as any,
      context: {},
      data: {},
      doc: {
        id: 'client-1',
        defaultTestType: 'test-type-new',
        redwoodDefaultTestSyncedCode: 'B729',
        redwoodDonorId: '2714034',
        redwoodSyncStatus: 'synced',
      },
      operation: 'update',
      previousDoc: {
        defaultTestType: 'test-type-old',
      },
      req: {
        payload: payloadMock,
      } as any,
    })

    expect(queueRedwoodDefaultTestSync).toHaveBeenCalledWith('client-1', payloadMock, expect.anything(), {
      previousSyncedCode: 'B729',
    })
  })

  it('falls back to the previous static default test mapping when no synced code is stored yet', async () => {
    const payloadMock: any = {
      findByID: vi.fn(),
      logger: {
        error: vi.fn(),
        info: vi.fn(),
      },
    }

    await queueRedwoodDefaultTestSyncAfterChange({
      collection: {} as any,
      context: {},
      data: {},
      doc: {
        id: 'client-1',
        defaultTestType: 'test-type-new',
        redwoodDonorId: '2714034',
        redwoodSyncStatus: 'synced',
      },
      operation: 'update',
      previousDoc: {
        defaultTestType: '11-panel-lab',
      },
      req: {
        payload: payloadMock,
      } as any,
    })

    expect(queueRedwoodDefaultTestSync).toHaveBeenCalledWith('client-1', payloadMock, expect.anything(), {
      previousSyncedCode: 'B729',
    })
  })

  it('skips default-test sync when the client is not Redwood-ready', async () => {
    const payloadMock: any = {
      findByID: vi.fn(),
      logger: {
        error: vi.fn(),
        info: vi.fn(),
      },
    }

    await queueRedwoodDefaultTestSyncAfterChange({
      collection: {} as any,
      context: {},
      data: {},
      doc: {
        id: 'client-1',
        defaultTestType: 'test-type-new',
        redwoodSyncStatus: 'queued',
      },
      operation: 'update',
      previousDoc: {
        defaultTestType: 'test-type-old',
      },
      req: {
        payload: payloadMock,
      } as any,
    })

    expect(queueRedwoodDefaultTestSync).not.toHaveBeenCalled()
    expect(payloadMock.logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        msg: '[clients] Skipped auto-queueing Redwood default-test sync because client is not Redwood-ready yet',
      }),
    )
  })
})
