import { describe, expect, it, vi } from 'vitest'

const { loginToRedwoodMock, withRedwoodBrowserSessionMock } = vi.hoisted(() => ({
  loginToRedwoodMock: vi.fn(async () => {
    throw new Error('forced login failure')
  }),
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

vi.mock('./redwoodDefaultTestSync', () => ({
  runRedwoodDefaultTestSync: vi.fn(),
}))

import { runRedwoodImportClientJob } from '@/collections/Clients/services/redwoodImportWorkflow'

describe('redwood import runtime profile', () => {
  it('uses the job runtime profile for queued import workflows', async () => {
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
})
