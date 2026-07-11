import { beforeEach, describe, expect, it, vi } from 'vitest'

const { queueRedwoodImportForClientMock } = vi.hoisted(() => ({
  queueRedwoodImportForClientMock: vi.fn().mockResolvedValue({ jobId: 'job-1' }),
}))

vi.mock('@/lib/redwood/queue', () => ({
  queueRedwoodImportForClient: queueRedwoodImportForClientMock,
}))

import { REDWOOD_SKIP_PROVISIONING_QUEUE_CONTEXT_KEY } from '@/lib/redwood/context'
import { queueRedwoodClientProvisioningAfterChange } from '../queueRedwoodClientProvisioning'

describe('queueRedwoodClientProvisioningAfterChange', () => {
  beforeEach(() => {
    queueRedwoodImportForClientMock.mockClear()
  })

  it('queues donor provisioning for a newly created client', async () => {
    const req = {
      context: {},
      payload: {
        logger: { error: vi.fn() },
        update: vi.fn(),
      },
      user: { id: 'admin-1', collection: 'admins' },
    }

    await queueRedwoodClientProvisioningAfterChange({
      doc: { id: 'client-1', isActive: true },
      operation: 'create',
      previousDoc: null,
      req,
    } as any)

    expect(queueRedwoodImportForClientMock).toHaveBeenCalledWith(
      'client-1',
      'admin-registration',
      req.payload,
      req,
    )
  })

  it('queues an import to reactivate a donor when a client becomes active again', async () => {
    const req = {
      context: {},
      payload: {
        logger: { error: vi.fn() },
        update: vi.fn(),
      },
      user: { id: 'admin-1', collection: 'admins' },
    }

    await queueRedwoodClientProvisioningAfterChange({
      doc: { id: 'client-2', isActive: true },
      operation: 'update',
      previousDoc: { isActive: false },
      req,
    } as any)

    expect(queueRedwoodImportForClientMock).toHaveBeenCalledWith(
      'client-2',
      'client-reactivation',
      req.payload,
      req,
    )
  })

  it('does not queue from internal Redwood status updates', async () => {
    await queueRedwoodClientProvisioningAfterChange({
      doc: { id: 'client-3', isActive: true },
      operation: 'update',
      previousDoc: { isActive: false },
      req: {
        context: { [REDWOOD_SKIP_PROVISIONING_QUEUE_CONTEXT_KEY]: true },
        payload: { logger: { error: vi.fn() }, update: vi.fn() },
      },
    } as any)

    expect(queueRedwoodImportForClientMock).not.toHaveBeenCalled()
  })
})
