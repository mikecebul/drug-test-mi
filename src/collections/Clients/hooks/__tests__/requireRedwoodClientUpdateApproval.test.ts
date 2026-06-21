import { describe, expect, it, vi } from 'vitest'
import { ValidationError } from 'payload'

import { REDWOOD_APPROVED_CLIENT_UPDATE_FIELDS_CONTEXT_KEY } from '@/lib/redwood/context'
import { requireRedwoodClientUpdateApproval } from '../requireRedwoodClientUpdateApproval'
import {
  REDWOOD_CLIENT_UPDATE_APPROVAL_FIELD,
  REDWOOD_CLIENT_UPDATE_SKIP_SYNC_FIELD,
  REDWOOD_PENDING_CLIENT_UPDATE_FIELDS,
} from '../../redwoodSyncFields'

type ApprovalHookArgs = Parameters<typeof requireRedwoodClientUpdateApproval>[0]

describe('requireRedwoodClientUpdateApproval', () => {
  it('requires approval before an admin can change Redwood-synced identity fields', async () => {
    expect(() =>
      requireRedwoodClientUpdateApproval({
        data: {
          phone: '248-555-1000',
        },
        operation: 'update',
        originalDoc: {
          phone: '248-555-9999',
          redwoodSyncStatus: 'synced',
        },
        req: {
          context: {},
          t: vi.fn(),
          user: {
            collection: 'admins',
            id: 'admin-1',
          },
        },
      } as unknown as ApprovalHookArgs),
    ).toThrow(ValidationError)
  })

  it('stores approved changed fields in request context and resets the checkbox', async () => {
    const data = {
      firstName: 'Michael',
      [REDWOOD_CLIENT_UPDATE_APPROVAL_FIELD]: true,
    }

    const req = {
      context: {},
      t: vi.fn(),
      user: {
        collection: 'admins',
        id: 'admin-1',
      },
    }

    const result = await requireRedwoodClientUpdateApproval({
      data,
      operation: 'update',
      originalDoc: {
        firstName: 'Mike',
        redwoodSyncStatus: 'synced',
      },
      req,
    } as unknown as ApprovalHookArgs)

    expect(result).toMatchObject({
      firstName: 'Michael',
      approveRedwoodSync: false,
      skipRedwoodSync: false,
      redwoodPendingSyncFields: ['firstName'],
    })
    expect(req.context).toMatchObject({
      [REDWOOD_APPROVED_CLIENT_UPDATE_FIELDS_CONTEXT_KEY]: ['firstName'],
    })
  })

  it('does not require approval for non-Redwood fields', async () => {
    const result = await requireRedwoodClientUpdateApproval({
      data: {
        email: 'new@example.com',
      },
      operation: 'update',
      originalDoc: {
        email: 'old@example.com',
        redwoodSyncStatus: 'synced',
      },
      req: {
        context: {},
        t: vi.fn(),
        user: {
          collection: 'admins',
          id: 'admin-1',
        },
      },
    } as unknown as ApprovalHookArgs)

    expect(result).toMatchObject({
      email: 'new@example.com',
      approveRedwoodSync: false,
      skipRedwoodSync: false,
    })
  })

  it('marks client-originated Redwood field edits as pending without queuing approval context', async () => {
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
        redwoodPendingSyncFields: [],
      },
      req,
    } as unknown as ApprovalHookArgs)

    expect(result).toMatchObject({
      phone: '248-555-1111',
      [REDWOOD_PENDING_CLIENT_UPDATE_FIELDS]: ['phone'],
    })
    expect(req.context).toEqual({})
  })

  it('allows a super-admin to save Redwood edits without queueing sync while keeping fields pending', async () => {
    const req = {
      context: {},
      t: vi.fn(),
      user: {
        collection: 'admins',
        id: 'admin-1',
        role: 'superAdmin',
      },
    }

    const result = await requireRedwoodClientUpdateApproval({
      data: {
        phone: '248-555-1111',
        [REDWOOD_CLIENT_UPDATE_SKIP_SYNC_FIELD]: true,
      },
      operation: 'update',
      originalDoc: {
        phone: '248-555-9999',
        redwoodSyncStatus: 'synced',
        redwoodPendingSyncFields: [],
      },
      req,
    } as unknown as ApprovalHookArgs)

    expect(result).toMatchObject({
      phone: '248-555-1111',
      approveRedwoodSync: false,
      skipRedwoodSync: false,
      redwoodPendingSyncFields: ['phone'],
    })
    expect(req.context).toEqual({})
  })

  it('blocks non-super-admin bypass attempts', async () => {
    expect(() =>
      requireRedwoodClientUpdateApproval({
        data: {
          phone: '248-555-1000',
          [REDWOOD_CLIENT_UPDATE_SKIP_SYNC_FIELD]: true,
        },
        operation: 'update',
        originalDoc: {
          phone: '248-555-9999',
          redwoodSyncStatus: 'synced',
        },
        req: {
          context: {},
          t: vi.fn(),
          user: {
            collection: 'admins',
            id: 'admin-1',
            role: 'admin',
          },
        },
      } as unknown as ApprovalHookArgs),
    ).toThrow(ValidationError)
  })
})
