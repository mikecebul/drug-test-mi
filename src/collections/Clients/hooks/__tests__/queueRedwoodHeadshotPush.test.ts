import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/redwood/queue', () => ({
  queueRedwoodHeadshotUpload: vi.fn().mockResolvedValue({ jobId: 'job-1' }),
}))

import { REDWOOD_SKIP_HEADSHOT_PUSH_CONTEXT_KEY } from '@/lib/redwood/context'
import { queueRedwoodHeadshotUpload } from '@/lib/redwood/queue'
import { queueRedwoodHeadshotPush } from '../queueRedwoodHeadshotPush'

describe('queueRedwoodHeadshotPush', () => {
  it('queues website-to-Redwood upload when an admin changes the headshot', async () => {
    await queueRedwoodHeadshotPush({
      doc: {
        id: 'client-1',
        headshot: 'media-new',
        redwoodSyncStatus: 'synced',
      },
      previousDoc: {
        headshot: 'media-old',
      },
      req: {
        context: {},
        payload: {
          logger: {
            error: vi.fn(),
          },
        },
        user: {
          id: 'admin-1',
          collection: 'admins',
        },
      },
    } as any)

    expect(queueRedwoodHeadshotUpload).toHaveBeenCalledWith('client-1', 'admin-1', expect.anything())
  })

  it('skips auto-queueing when the client is not Redwood-ready yet', async () => {
    await queueRedwoodHeadshotPush({
      doc: {
        id: 'client-2',
        headshot: 'media-new',
        redwoodSyncStatus: 'queued',
      },
      previousDoc: {
        headshot: 'media-old',
      },
      req: {
        context: {},
        payload: {
          logger: {
            error: vi.fn(),
            info: vi.fn(),
          },
        },
        user: {
          id: 'admin-1',
          collection: 'admins',
        },
      },
    } as any)

    expect(queueRedwoodHeadshotUpload).toHaveBeenCalledTimes(1)
  })

  it('skips queueing when the update originated from Redwood pull sync', async () => {
    await queueRedwoodHeadshotPush({
      doc: {
        id: 'client-1',
        headshot: 'media-new',
      },
      previousDoc: {
        headshot: 'media-old',
      },
      req: {
        context: {
          [REDWOOD_SKIP_HEADSHOT_PUSH_CONTEXT_KEY]: true,
        },
        payload: {
          logger: {
            error: vi.fn(),
          },
        },
        user: {
          id: 'admin-1',
          collection: 'admins',
        },
      },
    } as any)

    expect(queueRedwoodHeadshotUpload).toHaveBeenCalledTimes(1)
  })
})
