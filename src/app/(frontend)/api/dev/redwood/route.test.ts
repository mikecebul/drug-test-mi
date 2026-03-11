import { afterEach, describe, expect, it, vi } from 'vitest'

const {
  canUseHeadedRedwoodBrowserMock,
  getPayloadMock,
  runRedwoodImportClientJobMock,
} = vi.hoisted(() => ({
  canUseHeadedRedwoodBrowserMock: vi.fn(),
  getPayloadMock: vi.fn(),
  runRedwoodImportClientJobMock: vi.fn(),
}))

vi.mock('payload', () => ({
  getPayload: getPayloadMock,
}))

vi.mock('@payload-config', () => ({
  default: Promise.resolve({}),
}))

vi.mock('@/collections/Clients/services/redwoodImportWorkflow', () => ({
  runRedwoodImportClientJob: runRedwoodImportClientJobMock,
}))

vi.mock('@/collections/Clients/services/redwoodHeadshotSync', () => ({
  runRedwoodHeadshotSyncJob: vi.fn(),
}))

vi.mock('@/lib/redwood/playwright', () => ({
  canUseHeadedRedwoodBrowser: canUseHeadedRedwoodBrowserMock,
}))

vi.mock('@/lib/redwood/dev-actions', async () => {
  const actual = await vi.importActual<typeof import('@/lib/redwood/dev-actions')>('@/lib/redwood/dev-actions')
  return actual
})

vi.mock('@/lib/redwood/queue', () => ({
  queueRedwoodHeadshotSync: vi.fn(),
  queueRedwoodImportForClient: vi.fn(),
}))

import { POST } from '@/app/(frontend)/api/dev/redwood/route'

describe('redwood dev route', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('uses the dev-debug runtime profile for inline import runs', async () => {
    canUseHeadedRedwoodBrowserMock.mockReturnValue(true)
    getPayloadMock.mockResolvedValue({})
    runRedwoodImportClientJobMock.mockResolvedValue({
      status: 'synced',
      screenshotPath: '/tmp/redwood.png',
    })

    const response = await POST(
      new Request('http://localhost/api/dev/redwood', {
        method: 'POST',
        body: JSON.stringify({ action: 'import-inline', clientId: 'client-1' }),
      }),
    )

    expect(response.status).toBe(200)
    expect(runRedwoodImportClientJobMock).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: 'client-1',
        playwrightRuntimeProfile: 'dev-debug',
      }),
    )
  })

  it('rejects inline headed debug runs when no display server is available', async () => {
    canUseHeadedRedwoodBrowserMock.mockReturnValue(false)

    const response = await POST(
      new Request('http://localhost/api/dev/redwood', {
        method: 'POST',
        body: JSON.stringify({ action: 'import-inline', clientId: 'client-1' }),
      }),
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        error: expect.stringContaining('Headed Playwright is unavailable'),
      }),
    )
    expect(runRedwoodImportClientJobMock).not.toHaveBeenCalled()
  })
})
