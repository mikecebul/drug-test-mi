import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  assertRedwoodMutationAllowedMock,
  clearClientDefaultLabTestInRedwoodViaHttpMock,
  resolveClientRedwoodEligibleDefaultTestMock,
  syncClientDefaultLabTestInRedwoodViaHttpMock,
} = vi.hoisted(() => ({
  assertRedwoodMutationAllowedMock: vi.fn(),
  clearClientDefaultLabTestInRedwoodViaHttpMock: vi.fn(),
  resolveClientRedwoodEligibleDefaultTestMock: vi.fn(),
  syncClientDefaultLabTestInRedwoodViaHttpMock: vi.fn(),
}))

vi.mock('@/lib/redwood/config', () => ({
  assertRedwoodMutationAllowed: assertRedwoodMutationAllowedMock,
  getRedwoodAccountNumber: vi.fn(() => '310872'),
}))

vi.mock('@/lib/redwood/default-test', () => ({
  resolveClientRedwoodEligibleDefaultTest: resolveClientRedwoodEligibleDefaultTestMock,
}))

vi.mock('@/lib/redwood/incidents', () => ({
  classifyRedwoodIncident: vi.fn(() => ({
    errorClass: 'unknown',
    kind: 'monitor-only',
    retryable: true,
  })),
  upsertRedwoodIncidentAlert: vi.fn(),
}))

vi.mock('./redwoodDefaultTestHttpSync', () => ({
  clearClientDefaultLabTestInRedwoodViaHttp: clearClientDefaultLabTestInRedwoodViaHttpMock,
  syncClientDefaultLabTestInRedwoodViaHttp: syncClientDefaultLabTestInRedwoodViaHttpMock,
}))

import { runRedwoodDefaultTestSync } from './redwoodDefaultTestSync'

describe('runRedwoodDefaultTestSync', () => {
  beforeEach(() => {
    assertRedwoodMutationAllowedMock.mockClear()
    resolveClientRedwoodEligibleDefaultTestMock.mockReset()
    clearClientDefaultLabTestInRedwoodViaHttpMock.mockReset()
    syncClientDefaultLabTestInRedwoodViaHttpMock.mockReset()
  })

  it('syncs eligible default-test changes through the direct HTTP helper', async () => {
    resolveClientRedwoodEligibleDefaultTestMock.mockResolvedValue({
      kind: 'eligible',
      redwoodLabTestCode: 'B829',
    })
    syncClientDefaultLabTestInRedwoodViaHttpMock.mockResolvedValue({
      donorId: '2714034',
      selectedCode: 'B829',
      status: 'synced',
    })

    const payloadMock: any = {
      findByID: vi.fn().mockResolvedValue({
        id: 'client-1',
        defaultTestType: 'test-type-1',
        dob: '1990-01-01',
        firstName: 'Bob',
        lastName: 'Testing',
        redwoodDefaultTestSyncedCode: 'B729',
        redwoodDonorId: '2714034',
        redwoodUniqueId: 'RWD0001',
      }),
      logger: {
        error: vi.fn(),
      },
      update: vi.fn().mockResolvedValue({}),
    }

    const result = await runRedwoodDefaultTestSync(payloadMock, 'client-1')

    expect(result).toEqual({
      status: 'synced',
      success: true,
    })
    expect(syncClientDefaultLabTestInRedwoodViaHttpMock).toHaveBeenCalledWith({
      accountNumber: '310872',
      client: expect.objectContaining({
        id: 'client-1',
        redwoodDonorId: '2714034',
        redwoodUniqueId: 'RWD0001',
      }),
      previousSyncedCode: 'B729',
      redwoodLabTestCode: 'B829',
    })
    expect(payloadMock.update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'clients',
        data: expect.objectContaining({
          redwoodDefaultTestLastError: null,
          redwoodDefaultTestSyncedCode: 'B829',
          redwoodDefaultTestSyncStatus: 'synced',
          redwoodDonorId: '2714034',
        }),
        id: 'client-1',
      }),
    )
  })

  it('removes the previously managed lab default when the new default is not eligible', async () => {
    resolveClientRedwoodEligibleDefaultTestMock.mockResolvedValue({
      kind: 'skip',
      reason: 'The configured default test is not a lab test.',
    })
    clearClientDefaultLabTestInRedwoodViaHttpMock.mockResolvedValue({
      donorId: '2714034',
      status: 'cleared',
    })

    const payloadMock: any = {
      findByID: vi.fn().mockResolvedValue({
        id: 'client-1',
        defaultTestType: '15-panel-instant',
        dob: '1990-01-01',
        firstName: 'Bob',
        lastName: 'Testing',
        redwoodDefaultTestSyncedCode: 'B729',
        redwoodDonorId: '2714034',
        redwoodUniqueId: 'RWD0001',
      }),
      logger: { error: vi.fn() },
      update: vi.fn().mockResolvedValue({}),
    }

    const result = await runRedwoodDefaultTestSync(payloadMock, 'client-1')

    expect(result).toEqual({ status: 'skipped', success: true })
    expect(clearClientDefaultLabTestInRedwoodViaHttpMock).toHaveBeenCalledWith(
      expect.objectContaining({
        accountNumber: '310872',
        previouslySyncedCode: 'B729',
      }),
    )
    expect(payloadMock.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          redwoodDefaultTestSyncedCode: null,
          redwoodDefaultTestSyncStatus: 'skipped',
        }),
      }),
    )
  })
})
