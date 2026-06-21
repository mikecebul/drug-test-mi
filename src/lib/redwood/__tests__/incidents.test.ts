import { describe, expect, it, vi } from 'vitest'

import { classifyRedwoodIncident, upsertRedwoodIncidentAlert } from '@/lib/redwood/incidents'

describe('redwood incidents', () => {
  it('classifies runtime auth issues as monitor-only retryable failures', () => {
    expect(
      classifyRedwoodIncident({
        message: 'Redwood login failed: invalid credentials',
        jobType: 'import',
        phase: 'runtime',
      }),
    ).toEqual(
      expect.objectContaining({
        kind: 'monitor-only',
        retryable: true,
      }),
    )
  })

  it('classifies ambiguous donor matching as manual-review without retry', () => {
    expect(
      classifyRedwoodIncident({
        message: 'No Redwood donor rows found for unique ID "RWD001"',
        jobType: 'client-update',
        phase: 'runtime',
      }),
    ).toEqual(
      expect.objectContaining({
        kind: 'manual-review-required',
        retryable: false,
      }),
    )
  })

  it('classifies explicit partial-success escalations without retry', () => {
    expect(
      classifyRedwoodIncident({
        message: 'Redwood import completed, but donor identity metadata could not be resolved.',
        jobType: 'import',
        phase: 'partial-success',
      }),
    ).toEqual(
      expect.objectContaining({
        kind: 'partial-success',
        retryable: false,
      }),
    )
  })

  it('upserts repeated Redwood incidents instead of creating duplicates', async () => {
    const payloadMock: any = {
      create: vi.fn(),
      find: vi
        .fn()
        .mockResolvedValueOnce({
          docs: [],
        })
        .mockResolvedValueOnce({
          docs: [
            {
              id: 'alert-1',
              attemptCount: 1,
            },
          ],
        }),
      logger: {
        error: vi.fn(),
      },
      update: vi.fn().mockResolvedValue({}),
    }

    await upsertRedwoodIncidentAlert({
      payload: payloadMock,
      clientId: 'client-1',
      jobType: 'import',
      kind: 'business-critical-failure',
      title: 'Redwood import failed for client client-1',
      message: 'Unable to locate Redwood donor fields for update.',
    })

    await upsertRedwoodIncidentAlert({
      payload: payloadMock,
      clientId: 'client-1',
      jobType: 'import',
      kind: 'business-critical-failure',
      title: 'Redwood import failed for client client-1',
      message: 'Unable to locate Redwood donor fields for update.',
    })

    expect(payloadMock.create).toHaveBeenCalledTimes(1)
    expect(payloadMock.update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'admin-alerts',
        id: 'alert-1',
        data: expect.objectContaining({
          attemptCount: 2,
          resolved: false,
        }),
      }),
    )
  })

  it('reopens a resolved alert when the same Redwood incident recurs', async () => {
    const payloadMock: any = {
      create: vi.fn(),
      find: vi.fn().mockResolvedValue({
        docs: [
          {
            id: 'alert-2',
            attemptCount: 3,
            resolved: true,
          },
        ],
      }),
      logger: {
        error: vi.fn(),
      },
      update: vi.fn().mockResolvedValue({}),
    }

    await upsertRedwoodIncidentAlert({
      payload: payloadMock,
      clientId: 'client-2',
      jobType: 'default-test-sync',
      kind: 'partial-success',
      title: 'Redwood import completed with follow-up gap for client client-2',
      message: 'Redwood import completed, but required default-test sync could not be queued: queue unavailable',
    })

    expect(payloadMock.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'alert-2',
        data: expect.objectContaining({
          attemptCount: 4,
          resolved: false,
        }),
      }),
    )
  })
})
