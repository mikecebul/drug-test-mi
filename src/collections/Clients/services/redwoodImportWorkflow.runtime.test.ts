import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  createRedwoodClientViaHttpMock,
  loginToRedwoodMock,
  queueRedwoodDefaultTestSyncMock,
  resolveClientRedwoodEligibleDefaultTestMock,
  withRedwoodBrowserSessionMock,
} = vi.hoisted(() => ({
  createRedwoodClientViaHttpMock: vi.fn(),
  loginToRedwoodMock: vi.fn(async () => {
    throw new Error('forced login failure')
  }),
  queueRedwoodDefaultTestSyncMock: vi.fn(),
  resolveClientRedwoodEligibleDefaultTestMock: vi.fn(),
  withRedwoodBrowserSessionMock: vi.fn(
    async (options: unknown, run: (session: { page: Record<string, never> }) => Promise<unknown>) => {
      return run({ page: {} })
    },
  ),
}))

vi.mock('@/lib/admin-alerts', () => ({
  createAdminAlert: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/redwood/config', () => ({
  assertRedwoodMutationAllowed: vi.fn(),
  getRedwoodAccountNumber: vi.fn(() => '310974'),
}))

vi.mock('@/lib/redwood/default-test', () => ({
  resolveClientRedwoodEligibleDefaultTest: resolveClientRedwoodEligibleDefaultTestMock,
}))

vi.mock('@/lib/redwood/playwright', () => ({
  clickFirstVisible: vi.fn(),
  collectVisibleTexts: vi.fn(),
  dismissCookieBanner: vi.fn(),
  fillFirstVisibleInput: vi.fn(),
  loginToRedwood: loginToRedwoodMock,
  resolveRedwoodAuthEnv: vi.fn(() => ({
    loginUrl: 'https://example.com/login',
    password: 'password',
    username: 'username',
  })),
  waitForAnyVisible: vi.fn(),
  withRedwoodBrowserSession: withRedwoodBrowserSessionMock,
}))

vi.mock('@/lib/redwood/queue', () => ({
  queueRedwoodDefaultTestSync: queueRedwoodDefaultTestSyncMock,
}))

vi.mock('./redwoodClientHttpImport', () => ({
  createRedwoodClientViaHttp: createRedwoodClientViaHttpMock,
}))

import { runRedwoodImportClientJob } from '@/collections/Clients/services/redwoodImportWorkflow'

describe('redwood import runtime profile', () => {
  beforeEach(() => {
    delete process.env.REDWOOD_HTTP_IMPORT_DISABLED
    delete process.env.REDWOOD_IMPORT_PREVIEW_ONLY
    createRedwoodClientViaHttpMock.mockReset()
    loginToRedwoodMock.mockClear()
    queueRedwoodDefaultTestSyncMock.mockReset()
    queueRedwoodDefaultTestSyncMock.mockResolvedValue({ jobId: 'job-default-test-1' })
    resolveClientRedwoodEligibleDefaultTestMock.mockReset()
    resolveClientRedwoodEligibleDefaultTestMock.mockResolvedValue({ kind: 'not-eligible' })
    withRedwoodBrowserSessionMock.mockClear()
  })

  afterEach(() => {
    delete process.env.REDWOOD_HTTP_IMPORT_DISABLED
    delete process.env.REDWOOD_IMPORT_PREVIEW_ONLY
  })

  it('uses the job runtime profile for queued import workflows', async () => {
    process.env.REDWOOD_HTTP_IMPORT_DISABLED = 'true'

    const payloadMock: any = {
      findByID: vi.fn().mockResolvedValue({
        id: 'client-1',
        firstName: 'Michael',
        lastName: 'Cebulski',
        dob: '1990-01-01',
        redwoodUniqueId: 'RWD0001',
      }),
      update: vi.fn().mockResolvedValue({}),
      logger: {
        error: vi.fn(),
        info: vi.fn(),
      },
    }

    await expect(
      runRedwoodImportClientJob({
        clientId: 'client-1',
        payload: payloadMock,
        source: 'manual',
      }),
    ).rejects.toThrow('forced login failure')

    expect(withRedwoodBrowserSessionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        acceptDownloads: true,
        runtimeProfile: 'job',
      }),
      expect.any(Function),
    )
  })

  it('uses direct HTTP import before the browser workflow for frontend registrations', async () => {
    createRedwoodClientViaHttpMock.mockResolvedValue({
      callInCode: '123456',
      donorId: '2714034',
      matchedDonorName: null,
      status: 'imported',
    })

    const payloadMock: any = {
      findByID: vi.fn().mockResolvedValue({
        id: 'client-1',
        firstName: 'Bob',
        lastName: 'Testing',
        dob: '1990-01-01',
        gender: 'male',
        phone: '(555) 111-2222',
        redwoodUniqueId: 'RWD0001',
      }),
      update: vi.fn().mockResolvedValue({}),
      logger: {
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
      },
    }

    const result = await runRedwoodImportClientJob({
      clientId: 'client-1',
      payload: payloadMock,
      source: 'frontend-registration',
    })

    expect(result).toEqual({
      screenshotPath: '',
      status: 'synced',
    })
    expect(createRedwoodClientViaHttpMock).toHaveBeenCalledWith(
      expect.objectContaining({
        accountNumber: '310974',
        firstName: 'Bob',
        group: '',
        lastName: 'Testing',
        phoneNumber: '555-111-2222',
        sex: 'M',
        uniqueId: 'RWD0001',
      }),
    )
    expect(withRedwoodBrowserSessionMock).not.toHaveBeenCalled()
    expect(queueRedwoodDefaultTestSyncMock).toHaveBeenCalledWith('client-1', payloadMock)
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

  it('routes active direct HTTP unique ID matches through the existing matched donor state', async () => {
    createRedwoodClientViaHttpMock.mockResolvedValue({
      callInCode: '654321',
      donorId: '2714034',
      matchedDonorName: 'Testing, Bob',
      status: 'matched-existing',
    })

    const payloadMock: any = {
      findByID: vi.fn().mockResolvedValue({
        id: 'client-1',
        firstName: 'Bob',
        lastName: 'Testing',
        dob: '1990-01-01',
        redwoodUniqueId: 'RWD0001',
      }),
      update: vi.fn().mockResolvedValue({}),
      logger: {
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
      },
    }

    const result = await runRedwoodImportClientJob({
      clientId: 'client-1',
      payload: payloadMock,
      source: 'frontend-registration',
    })

    expect(result).toEqual({
      matchedBy: 'unique-id',
      screenshotPath: '',
      status: 'matched-existing',
    })
    expect(withRedwoodBrowserSessionMock).not.toHaveBeenCalled()
    expect(payloadMock.update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'clients',
        data: expect.objectContaining({
          redwoodMatchedBy: 'unique-id',
          redwoodMatchedDonorName: 'Testing, Bob',
          redwoodSyncStatus: 'matched-existing',
        }),
        id: 'client-1',
      }),
    )
  })
})
