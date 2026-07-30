import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  getPayload: vi.fn(),
  preview: vi.fn(),
}))

vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', () => ({ getPayload: mocks.getPayload }))
vi.mock('@/lib/random-testing/todays-schedule', () => ({
  previewTodaysScheduledCollections: mocks.preview,
}))

import { GET } from './route'

describe('scheduled collections API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getPayload.mockResolvedValue({
      auth: mocks.auth,
      logger: { error: vi.fn() },
    })
  })

  test('returns the read-only donor-matching preview to an admin', async () => {
    mocks.auth.mockResolvedValue({
      user: { collection: 'admins', id: 'admin-1', role: 'admin' },
    })
    mocks.preview.mockResolvedValue([
      {
        clientId: 'client-1',
        collectionKey: '2026-07-29:1234567',
        donorId: '1234567',
        donorName: 'Example Donor',
        status: 'ready',
      },
    ])

    const response = await GET(new NextRequest('http://localhost/api/redwood/scheduled-collections'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      count: 1,
      collections: [expect.objectContaining({ donorId: '1234567', status: 'ready' })],
    })
  })

  test('rejects client accounts because the preview contains donor identifiers', async () => {
    mocks.auth.mockResolvedValue({
      user: { collection: 'clients', id: 'client-1' },
    })

    const response = await GET(new NextRequest('http://localhost/api/redwood/scheduled-collections'))

    expect(response.status).toBe(403)
    expect(mocks.preview).not.toHaveBeenCalled()
  })
})
