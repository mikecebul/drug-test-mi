import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/redwood/queue', () => ({
  queueRedwoodClientUpdate: vi.fn().mockResolvedValue({ jobId: 'job-1' }),
}))

import { REDWOOD_SKIP_CLIENT_UPDATE_QUEUE_CONTEXT_KEY } from '@/lib/redwood/context'
import { queueRedwoodClientUpdate } from '@/lib/redwood/queue'
import {
  getChangedRedwoodClientUpdateFields,
  queueRedwoodClientUpdateAfterChange,
} from '../queueRedwoodClientUpdate'

type QueueHookArgs = Parameters<typeof queueRedwoodClientUpdateAfterChange>[0]

describe('queueRedwoodClientUpdateAfterChange', () => {
  it('detects sync-relevant client changes', () => {
    expect(
      getChangedRedwoodClientUpdateFields(
        {
          firstName: 'Michael',
          lastName: 'Cebulski',
          phone: '(248) 555-1000',
        },
        {
          firstName: 'Mike',
          lastName: 'Cebulsky',
          phone: '248-555-1000',
        },
      ),
    ).toEqual(['firstName', 'lastName'])
  })

  it('queues one Redwood client update when syncable fields change on a synced client', async () => {
    await queueRedwoodClientUpdateAfterChange({
      doc: {
        id: 'client-1',
        firstName: 'Michael',
        phone: '248-555-1000',
        redwoodSyncStatus: 'synced',
      },
      operation: 'update',
      previousDoc: {
        firstName: 'Mike',
        phone: '248-555-2000',
        redwoodSyncStatus: 'synced',
      },
      req: {
        context: {},
        payload: {
          logger: {
            error: vi.fn(),
          },
        },
        user: {
          collection: 'admins',
          id: 'admin-1',
        },
      },
    } as QueueHookArgs)

    expect(queueRedwoodClientUpdate).toHaveBeenCalledWith(
      'client-1',
      ['firstName', 'phone'],
      'admin-1',
      expect.anything(),
    )
  })

  it('skips queueing when the update only changes Redwood bookkeeping', async () => {
    await queueRedwoodClientUpdateAfterChange({
      doc: {
        id: 'client-1',
        redwoodClientUpdateStatus: 'queued',
        redwoodSyncStatus: 'synced',
      },
      operation: 'update',
      previousDoc: {
        redwoodClientUpdateStatus: 'not-queued',
        redwoodSyncStatus: 'synced',
      },
      req: {
        context: {},
        payload: {
          logger: {
            error: vi.fn(),
          },
        },
      },
    } as QueueHookArgs)

    expect(queueRedwoodClientUpdate).toHaveBeenCalledTimes(1)
  })

  it('skips queueing when explicitly disabled by context', async () => {
    await queueRedwoodClientUpdateAfterChange({
      doc: {
        id: 'client-2',
        phone: '248-555-1000',
        redwoodSyncStatus: 'synced',
      },
      operation: 'update',
      previousDoc: {
        phone: '248-555-2000',
        redwoodSyncStatus: 'synced',
      },
      req: {
        context: {
          [REDWOOD_SKIP_CLIENT_UPDATE_QUEUE_CONTEXT_KEY]: true,
        },
        payload: {
          logger: {
            error: vi.fn(),
          },
        },
      },
    } as QueueHookArgs)

    expect(queueRedwoodClientUpdate).toHaveBeenCalledTimes(1)
  })
})
