import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { queueRedwoodImportForClientMock } = vi.hoisted(() => ({
  queueRedwoodImportForClientMock: vi.fn().mockResolvedValue({ jobId: 'job-1' }),
}))

vi.mock('@/lib/redwood/queue', () => ({
  queueRedwoodImportForClient: queueRedwoodImportForClientMock,
}))

import {
  REDWOOD_PROVISIONING_SOURCE_CONTEXT_KEY,
  REDWOOD_SKIP_PROVISIONING_QUEUE_CONTEXT_KEY,
} from '@/lib/redwood/context'
import { queueRedwoodClientProvisioningAfterChange } from '../queueRedwoodClientProvisioning'

function createPayloadRequest(context: Record<string, unknown> = {}) {
  return {
    context,
    payload: {
      logger: {
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
      },
      update: vi.fn(),
    },
    user: { id: 'admin-1', collection: 'admins' },
  }
}

describe('queueRedwoodClientProvisioningAfterChange', () => {
  beforeEach(() => {
    queueRedwoodImportForClientMock.mockClear()
    vi.stubEnv('REDWOOD_AUTOMATION_ENABLED', 'true')
    vi.stubEnv('NODE_ENV', 'production')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('queues donor provisioning for a newly created client and logs runtime diagnostics', async () => {
    const req = {
      ...createPayloadRequest({ [REDWOOD_PROVISIONING_SOURCE_CONTEXT_KEY]: 'frontend-registration' }),
      user: null,
    }

    await queueRedwoodClientProvisioningAfterChange({
      doc: { id: 'client-1', isActive: true },
      operation: 'create',
      previousDoc: null,
      req,
    } as any)

    expect(req.payload.logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        msg: '[clients] Attempting to queue Redwood donor provisioning',
        automationConfigured: true,
        automationConfiguredValue: 'true',
        automationEnabled: true,
        clientId: 'client-1',
        nodeEnv: 'production',
        redwoodAccountNumber: '310974',
        source: 'frontend-registration',
      }),
    )
    expect(queueRedwoodImportForClientMock).toHaveBeenCalledWith(
      'client-1',
      'frontend-registration',
      req.payload,
      req,
    )
  })

  it('queues an import to reactivate a donor when a client becomes active again', async () => {
    const req = createPayloadRequest()

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

  it('logs when runtime configuration disables provisioning', async () => {
    vi.stubEnv('REDWOOD_AUTOMATION_ENABLED', 'false')
    const req = createPayloadRequest()

    await queueRedwoodClientProvisioningAfterChange({
      doc: { id: 'client-3', isActive: true },
      operation: 'create',
      previousDoc: null,
      req,
    } as any)

    expect(queueRedwoodImportForClientMock).not.toHaveBeenCalled()
    expect(req.payload.logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        msg: '[clients] Skipped Redwood donor provisioning because automation is disabled',
        automationConfiguredValue: 'false',
        skipReason: 'automation-disabled',
      }),
    )
  })

  it('logs when request context skips an otherwise eligible reactivation', async () => {
    const req = createPayloadRequest({ [REDWOOD_SKIP_PROVISIONING_QUEUE_CONTEXT_KEY]: true })

    await queueRedwoodClientProvisioningAfterChange({
      doc: { id: 'client-4', isActive: true },
      operation: 'update',
      previousDoc: { isActive: false },
      req,
    } as any)

    expect(queueRedwoodImportForClientMock).not.toHaveBeenCalled()
    expect(req.payload.logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        msg: '[clients] Skipped Redwood donor provisioning because request context disabled it',
        skipReason: 'request-context',
      }),
    )
  })

  it('logs when a newly created client is inactive', async () => {
    const req = createPayloadRequest()

    await queueRedwoodClientProvisioningAfterChange({
      doc: { id: 'client-5', isActive: false },
      operation: 'create',
      previousDoc: null,
      req,
    } as any)

    expect(queueRedwoodImportForClientMock).not.toHaveBeenCalled()
    expect(req.payload.logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        msg: '[clients] Skipped Redwood donor provisioning for an inactive client',
        skipReason: 'inactive-client',
      }),
    )
  })
})
