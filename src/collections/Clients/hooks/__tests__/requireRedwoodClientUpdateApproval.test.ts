import { afterEach, describe, expect, it, vi } from 'vitest'

import { REDWOOD_APPROVED_CLIENT_UPDATE_FIELDS_CONTEXT_KEY } from '@/lib/redwood/context'
import { requireRedwoodClientUpdateApproval } from '../requireRedwoodClientUpdateApproval'

type ApprovalHookArgs = Parameters<typeof requireRedwoodClientUpdateApproval>[0]

describe('requireRedwoodClientUpdateApproval', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('automatically approves eligible changes when Redwood automation is enabled', async () => {
    vi.stubEnv('REDWOOD_AUTOMATION_ENABLED', 'true')

    const req = {
      context: {},
      t: vi.fn(),
      user: {
        collection: 'admins',
        id: 'admin-1',
      },
    }

    const result = await requireRedwoodClientUpdateApproval({
      data: {
        firstName: 'Michael',
      },
      operation: 'update',
      originalDoc: {
        firstName: 'Mike',
        redwoodSyncStatus: 'synced',
      },
      req,
    } as unknown as ApprovalHookArgs)

    expect(result).toMatchObject({
      firstName: 'Michael',
    })
    expect(req.context).toMatchObject({
      [REDWOOD_APPROVED_CLIENT_UPDATE_FIELDS_CONTEXT_KEY]: ['firstName'],
    })
  })

  it('never blocks a client save when Redwood automation is disabled', async () => {
    vi.stubEnv('REDWOOD_AUTOMATION_ENABLED', 'false')
    const req = {
      context: {},
      t: vi.fn(),
      user: {
        collection: 'admins',
        id: 'admin-1',
      },
    }

    const result = await requireRedwoodClientUpdateApproval({
      data: {
        phone: '248-555-1000',
      },
      operation: 'update',
      originalDoc: {
        phone: '248-555-9999',
        redwoodSyncStatus: 'synced',
      },
      req,
    } as unknown as ApprovalHookArgs)

    expect(result).toMatchObject({
      phone: '248-555-1000',
    })
    expect(req.context).toEqual({})
  })

  it('does not queue non-Redwood field changes', async () => {
    vi.stubEnv('REDWOOD_AUTOMATION_ENABLED', 'true')
    const req = {
      context: {},
      t: vi.fn(),
      user: {
        collection: 'admins',
        id: 'admin-1',
      },
    }

    const result = await requireRedwoodClientUpdateApproval({
      data: {
        email: 'new@example.com',
      },
      operation: 'update',
      originalDoc: {
        email: 'old@example.com',
        redwoodSyncStatus: 'synced',
      },
      req,
    } as unknown as ApprovalHookArgs)

    expect(result).toMatchObject({
      email: 'new@example.com',
    })
    expect(req.context).toEqual({})
  })

  it('automatically approves client-originated changes when automation is enabled', async () => {
    vi.stubEnv('REDWOOD_AUTOMATION_ENABLED', 'true')
    const req = {
      context: {},
      t: vi.fn(),
      user: {
        collection: 'clients',
        id: 'client-1',
      },
    }

    const result = await requireRedwoodClientUpdateApproval({
      data: {
        phone: '248-555-1111',
      },
      operation: 'update',
      originalDoc: {
        phone: '248-555-9999',
        redwoodSyncStatus: 'synced',
      },
      req,
    } as unknown as ApprovalHookArgs)

    expect(result).toMatchObject({
      phone: '248-555-1111',
    })
    expect(req.context).toEqual({
      [REDWOOD_APPROVED_CLIENT_UPDATE_FIELDS_CONTEXT_KEY]: ['phone'],
    })
  })
})
