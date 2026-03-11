import { describe, expect, it, vi } from 'vitest'

const { upsertRedwoodIncidentAlertMock } = vi.hoisted(() => ({
  upsertRedwoodIncidentAlertMock: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/redwood/incidents', () => ({
  classifyRedwoodIncident: vi.fn((args: { message: string }) => {
    if (args.message.includes('Client ID is required')) {
      return { errorClass: 'invalid-input', kind: 'monitor-only', retryable: false }
    }

    return { errorClass: 'unknown', kind: 'business-critical-failure', retryable: false }
  }),
  upsertRedwoodIncidentAlert: upsertRedwoodIncidentAlertMock,
}))

vi.mock('./redwoodHeadshotScraper', () => ({
  fetchRedwoodHeadshotForClient: vi.fn(),
}))

import { runRedwoodHeadshotSyncJob } from './redwoodHeadshotSync'

describe('runRedwoodHeadshotSyncJob', () => {
  it('does not create an admin alert for invalid non-business-critical input', async () => {
    const payloadMock: any = {
      logger: {
        error: vi.fn(),
      },
    }

    const result = await runRedwoodHeadshotSyncJob(payloadMock, '')

    expect(result).toEqual(
      expect.objectContaining({
        errorCode: 'INVALID_INPUT',
        retryable: false,
        status: 'failed',
        success: false,
      }),
    )
    expect(upsertRedwoodIncidentAlertMock).not.toHaveBeenCalled()
  })
})
