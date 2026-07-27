import { describe, expect, it, vi } from 'vitest'
import type { Payload } from 'payload'

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
        message: 'No DOB-verified Redwood donor match found across allowed accounts',
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

  it('classifies an unapproved donor account as manual-review without retry', () => {
    expect(
      classifyRedwoodIncident({
        jobType: 'client-update',
        message:
          'Redwood donor 2714034 belongs to account 999999, which is not in REDWOOD_ALLOWED_ACCOUNT_NUMBERS (310974, 310872).',
      }),
    ).toEqual({
      errorClass: 'donor-account-review',
      kind: 'manual-review-required',
      retryable: false,
    })
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

  it('classifies duplicate-prevention blocks as manual review incidents', () => {
    expect(
      classifyRedwoodIncident({
        message:
          'Potential existing Redwood donor: automatic donor creation was blocked to prevent a duplicate. Manual review required.',
        jobType: 'import',
        phase: 'runtime',
      }),
    ).toEqual({
      errorClass: 'duplicate-prevention-block',
      kind: 'manual-review-required',
      retryable: false,
    })
  })

  it('classifies exact-name DOB mismatches as a distinct manual review incident', () => {
    expect(
      classifyRedwoodIncident({
        message:
          'Exact-name Redwood donor match has a different DOB: donor 2656596 (Mosley, Ronald) in account 310872 has ToxAccess DOB 1982-11-30, while Payload has DOB 1982-12-01; manual review required.',
        jobType: 'import',
        phase: 'runtime',
      }),
    ).toEqual({
      errorClass: 'donor-dob-mismatch',
      kind: 'manual-review-required',
      retryable: false,
    })
  })

  it('gives exact-name DOB mismatch alerts a correction-specific recommendation', async () => {
    const payloadMock = {
      create: vi.fn().mockResolvedValue({}),
      find: vi.fn().mockResolvedValue({ docs: [] }),
      logger: {
        error: vi.fn(),
      },
    }

    await upsertRedwoodIncidentAlert({
      payload: payloadMock as unknown as Payload,
      clientId: 'client-1',
      jobType: 'import',
      kind: 'manual-review-required',
      title: 'Redwood donor provisioning needs attention for client client-1',
      message:
        'Exact-name Redwood donor match has a different DOB: donor 2656596 (Mosley, Ronald) in account 310872 has ToxAccess DOB 1982-11-30, while Payload has DOB 1982-12-01; manual review required.',
    })

    expect(payloadMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          recommendedAction: expect.stringContaining('Compare the Payload and ToxAccess DOBs'),
        }),
      }),
    )
  })

  it('upserts repeated Redwood incidents instead of creating duplicates', async () => {
    const payloadMock = {
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
      payload: payloadMock as unknown as Payload,
      clientId: 'client-1',
      jobType: 'import',
      kind: 'business-critical-failure',
      title: 'Redwood import failed for client client-1',
      message: 'Unable to locate Redwood donor fields for update.',
    })

    await upsertRedwoodIncidentAlert({
      payload: payloadMock as unknown as Payload,
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
    const payloadMock = {
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
      payload: payloadMock as unknown as Payload,
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
