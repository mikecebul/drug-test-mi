import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/redwood/queue', () => ({
  queueRedwoodClientUpdate: vi.fn().mockResolvedValue({ jobId: 'job-1' }),
}))

import {
  REDWOOD_APPROVED_CLIENT_UPDATE_FIELDS_CONTEXT_KEY,
  REDWOOD_SKIP_CLIENT_UPDATE_QUEUE_CONTEXT_KEY,
} from '@/lib/redwood/context'
import { queueRedwoodClientUpdate } from '@/lib/redwood/queue'
import { REDWOOD_PENDING_CLIENT_UPDATE_FIELDS } from '../../redwoodSyncFields'
import { getChangedRedwoodClientUpdateFields, queueRedwoodClientUpdateAfterChange } from '../queueRedwoodClientUpdate'

type QueueHookArgs = Parameters<typeof queueRedwoodClientUpdateAfterChange>[0]

describe('queueRedwoodClientUpdateAfterChange', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('REDWOOD_AUTOMATION_ENABLED', 'true')
  })

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

  it('queues one Redwood client update when syncable fields change on a synced client and approval is present', async () => {
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
        context: {
          [REDWOOD_APPROVED_CLIENT_UPDATE_FIELDS_CONTEXT_KEY]: ['firstName', 'phone'],
        },
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
    } as unknown as QueueHookArgs)

    expect(queueRedwoodClientUpdate).toHaveBeenCalledWith(
      'client-1',
      ['firstName', 'phone'],
      'admin-1',
      expect.anything(),
      expect.anything(),
    )
  })

  it('skips queueing when a changed field was not prepared by the before-change hook', async () => {
    await queueRedwoodClientUpdateAfterChange({
      doc: {
        id: 'client-1',
        firstName: 'Michael',
        redwoodSyncStatus: 'synced',
      },
      operation: 'update',
      previousDoc: {
        firstName: 'Mike',
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
    } as unknown as QueueHookArgs)

    expect(queueRedwoodClientUpdate).not.toHaveBeenCalled()
  })

  it('queues when a client changes a Redwood-backed field approved by the before-change hook', async () => {
    await queueRedwoodClientUpdateAfterChange({
      doc: {
        id: 'client-9',
        phone: '248-555-1000',
        redwoodSyncStatus: 'synced',
      },
      operation: 'update',
      previousDoc: {
        phone: '248-555-9999',
        redwoodSyncStatus: 'synced',
      },
      req: {
        context: {
          [REDWOOD_APPROVED_CLIENT_UPDATE_FIELDS_CONTEXT_KEY]: ['phone'],
        },
        payload: {
          logger: {
            error: vi.fn(),
          },
        },
        user: {
          collection: 'clients',
          id: 'client-9',
        },
      },
    } as unknown as QueueHookArgs)

    expect(queueRedwoodClientUpdate).toHaveBeenCalledWith(
      'client-9',
      ['phone'],
      undefined,
      expect.anything(),
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
    } as unknown as QueueHookArgs)

    expect(queueRedwoodClientUpdate).not.toHaveBeenCalled()
  })

  it('skips queueing when an instant test updates only client medications', async () => {
    await queueRedwoodClientUpdateAfterChange({
      doc: {
        id: 'client-1',
        firstName: 'Isaac',
        lastName: 'Hoaglung',
        phone: '231-555-0100',
        medications: [{ medicationName: 'Prescription A', status: 'active' }],
        redwoodSyncStatus: 'synced',
      },
      operation: 'update',
      previousDoc: {
        id: 'client-1',
        firstName: 'Isaac',
        lastName: 'Hoaglung',
        phone: '231-555-0100',
        medications: [],
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
    } as unknown as QueueHookArgs)

    expect(queueRedwoodClientUpdate).not.toHaveBeenCalled()
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
    } as unknown as QueueHookArgs)

    expect(queueRedwoodClientUpdate).not.toHaveBeenCalled()
  })

  it('merges old pending drift into the next automatic sync', async () => {
    await queueRedwoodClientUpdateAfterChange({
      doc: {
        id: 'client-3',
        phone: '248-555-1000',
        redwoodSyncStatus: 'synced',
      },
      operation: 'update',
      previousDoc: {
        phone: '248-555-2000',
        redwoodSyncStatus: 'synced',
        [REDWOOD_PENDING_CLIENT_UPDATE_FIELDS]: ['lastName'],
        redwoodClientUpdateStatus: 'failed',
      },
      req: {
        context: {
          [REDWOOD_APPROVED_CLIENT_UPDATE_FIELDS_CONTEXT_KEY]: ['phone'],
        },
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
    } as unknown as QueueHookArgs)

    expect(queueRedwoodClientUpdate).toHaveBeenCalledWith(
      'client-3',
      ['phone', 'lastName'],
      'admin-1',
      expect.anything(),
      expect.anything(),
    )
  })

  it('allows a later edit to queue behind an active client update', async () => {
    await queueRedwoodClientUpdateAfterChange({
      doc: {
        id: 'client-4',
        lastName: 'Public',
        redwoodSyncStatus: 'synced',
      },
      operation: 'update',
      previousDoc: {
        lastName: 'Publik',
        redwoodSyncStatus: 'synced',
        redwoodClientUpdateStatus: 'queued',
      },
      req: {
        context: {
          [REDWOOD_APPROVED_CLIENT_UPDATE_FIELDS_CONTEXT_KEY]: ['lastName'],
        },
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
    } as unknown as QueueHookArgs)

    expect(queueRedwoodClientUpdate).toHaveBeenCalledWith(
      'client-4',
      ['lastName'],
      'admin-1',
      expect.anything(),
      expect.anything(),
    )
  })

  it('does not queue when Redwood automation is disabled', async () => {
    vi.stubEnv('REDWOOD_AUTOMATION_ENABLED', 'false')

    await queueRedwoodClientUpdateAfterChange({
      doc: {
        id: 'client-5',
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
          [REDWOOD_APPROVED_CLIENT_UPDATE_FIELDS_CONTEXT_KEY]: ['phone'],
        },
        payload: {
          logger: {
            error: vi.fn(),
          },
        },
      },
    } as unknown as QueueHookArgs)

    expect(queueRedwoodClientUpdate).not.toHaveBeenCalled()
  })
})
