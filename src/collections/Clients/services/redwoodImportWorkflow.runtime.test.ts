import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  classifyRedwoodIncidentMock,
  createRedwoodClientViaHttpMock,
  queueRedwoodDefaultTestSyncMock,
  resolveClientRedwoodEligibleDefaultTestMock,
  upsertRedwoodIncidentAlertMock,
} = vi.hoisted(() => ({
  classifyRedwoodIncidentMock: vi.fn(),
  createRedwoodClientViaHttpMock: vi.fn(),
  queueRedwoodDefaultTestSyncMock: vi.fn(),
  resolveClientRedwoodEligibleDefaultTestMock: vi.fn(),
  upsertRedwoodIncidentAlertMock: vi.fn(),
}))

vi.mock('@/lib/redwood/config', () => ({
  assertRedwoodMutationAllowed: vi.fn(),
  getRedwoodAccountNumber: vi.fn(() => '310974'),
}))

vi.mock('@/lib/redwood/default-test', () => ({
  resolveClientRedwoodEligibleDefaultTest: resolveClientRedwoodEligibleDefaultTestMock,
}))

vi.mock('@/lib/redwood/incidents', () => ({
  classifyRedwoodIncident: classifyRedwoodIncidentMock,
  upsertRedwoodIncidentAlert: upsertRedwoodIncidentAlertMock,
}))

vi.mock('@/lib/redwood/queue', () => ({
  queueRedwoodDefaultTestSync: queueRedwoodDefaultTestSyncMock,
}))

vi.mock('./redwoodClientHttpImport', () => ({
  createRedwoodClientViaHttp: createRedwoodClientViaHttpMock,
}))

import { runRedwoodImportClientJob } from './redwoodImportWorkflow'

function createPayloadMock() {
  return {
    findByID: vi.fn().mockResolvedValue({
      id: 'client-1',
      firstName: 'Bob',
      lastName: 'Testing',
      dob: '1990-01-01',
      gender: 'male',
      phone: '(555) 111-2222',
      referralType: 'court',
      redwoodUniqueId: 'RWD0001',
    }),
    update: vi.fn().mockResolvedValue({}),
    logger: {
      error: vi.fn(),
      info: vi.fn(),
    },
  }
}

describe('Redwood direct HTTP import workflow', () => {
  beforeEach(() => {
    classifyRedwoodIncidentMock.mockReset()
    createRedwoodClientViaHttpMock.mockReset()
    queueRedwoodDefaultTestSyncMock.mockReset()
    resolveClientRedwoodEligibleDefaultTestMock.mockReset()
    upsertRedwoodIncidentAlertMock.mockReset()
    resolveClientRedwoodEligibleDefaultTestMock.mockResolvedValue({
      kind: 'skip',
      reason: 'No lab default is required.',
    })
  })

  it('creates and verifies a donor through the reconstructed HTTP form workflow', async () => {
    createRedwoodClientViaHttpMock.mockResolvedValue({
      callInCode: '123456',
      donorId: '2714034',
      matchedDonorName: null,
      status: 'imported',
    })
    const payloadMock = createPayloadMock()

    const result = await runRedwoodImportClientJob({
      clientId: 'client-1',
      payload: payloadMock as never,
      source: 'frontend-registration',
    })

    expect(result).toEqual({ status: 'synced' })
    expect(createRedwoodClientViaHttpMock).toHaveBeenCalledWith(
      expect.objectContaining({
        accountNumber: '310974',
        firstName: 'Bob',
        group: 'Court',
        lastName: 'Testing',
        phoneNumber: '555-111-2222',
        sex: 'M',
        uniqueId: 'RWD0001',
      }),
    )
    expect(payloadMock.update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'clients',
        data: expect.objectContaining({
          redwoodCallInCode: '123456',
          redwoodDonorId: '2714034',
          redwoodSyncStatus: 'synced',
        }),
        id: 'client-1',
      }),
    )
  })

  it('records inactive donor reactivation as a ready donor', async () => {
    createRedwoodClientViaHttpMock.mockResolvedValue({
      callInCode: '654321',
      donorId: '2714034',
      matchedBy: 'unique-id',
      matchedDonorName: 'Testing, Bob',
      status: 'reactivated-existing',
    })
    const payloadMock = createPayloadMock()

    const result = await runRedwoodImportClientJob({
      clientId: 'client-1',
      payload: payloadMock as never,
      source: 'client-reactivation',
    })

    expect(result).toEqual({ matchedBy: 'unique-id', status: 'reactivated-existing' })
    expect(payloadMock.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          redwoodSyncStatus: 'reactivated-existing',
          redwoodDonorId: '2714034',
        }),
      }),
    )
  })

  it('throws transient HTTP failures so the Payload job retries without creating an early alert', async () => {
    createRedwoodClientViaHttpMock.mockRejectedValue(new Error('Redwood request timed out'))
    classifyRedwoodIncidentMock.mockReturnValue({
      errorClass: 'unknown',
      kind: 'monitor-only',
      retryable: true,
    })
    const payloadMock = createPayloadMock()

    await expect(
      runRedwoodImportClientJob({
        clientId: 'client-1',
        payload: payloadMock as never,
        source: 'wizard-registration',
      }),
    ).rejects.toThrow('Redwood request timed out')

    expect(payloadMock.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ redwoodSyncStatus: 'queued' }),
      }),
    )
    expect(upsertRedwoodIncidentAlertMock).not.toHaveBeenCalled()
  })
})
