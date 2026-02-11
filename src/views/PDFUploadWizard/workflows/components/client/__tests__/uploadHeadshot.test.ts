import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getPayload } from 'payload'
import { headers } from 'next/headers'
import { createAdminAlert } from '@/lib/admin-alerts'
import { uploadHeadshot } from '../uploadHeadshot'

vi.mock('payload', () => ({
  getPayload: vi.fn(),
}))

vi.mock('@payload-config', () => ({
  default: {},
}))

vi.mock('next/headers', () => ({
  headers: vi.fn(),
}))

vi.mock('@/lib/admin-alerts', () => ({
  createAdminAlert: vi.fn(),
}))

type MockPayload = {
  auth: ReturnType<typeof vi.fn>
  findByID: ReturnType<typeof vi.fn>
  create: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  logger: {
    info: ReturnType<typeof vi.fn>
    error: ReturnType<typeof vi.fn>
  }
}

describe('uploadHeadshot', () => {
  let payloadMock: MockPayload

  beforeEach(() => {
    vi.clearAllMocks()

    payloadMock = {
      auth: vi.fn(),
      findByID: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      logger: {
        info: vi.fn(),
        error: vi.fn(),
      },
    }

    vi.mocked(getPayload).mockResolvedValue(payloadMock as any)
    vi.mocked(headers).mockResolvedValue(new Headers() as any)
    payloadMock.auth.mockResolvedValue({
      user: { id: 'admin-1', collection: 'admins' },
    })
    payloadMock.findByID.mockResolvedValue({
      id: 'client-1',
      firstName: 'John',
      middleInitial: 'Q',
      lastName: 'Public',
    })
  })

  it('returns UNAUTHORIZED when caller is not an admin', async () => {
    payloadMock.auth.mockResolvedValue({ user: null })

    const result = await uploadHeadshot('client-1', [1, 2, 3], 'image/jpeg', 'headshot.jpg')

    expect(result.success).toBe(false)
    expect(result.errorCode).toBe('UNAUTHORIZED')
    expect(vi.mocked(createAdminAlert)).toHaveBeenCalledOnce()
  })

  it('returns INVALID_INPUT for missing parameters', async () => {
    const result = await uploadHeadshot('', [], 'image/jpeg', '')

    expect(result.success).toBe(false)
    expect(result.errorCode).toBe('INVALID_INPUT')
    expect(payloadMock.create).not.toHaveBeenCalled()
    expect(payloadMock.update).not.toHaveBeenCalled()
  })

  it('creates a new private-media headshot and links it to the client', async () => {
    payloadMock.create.mockResolvedValue({
      id: 'media-1',
      thumbnailURL: '/media/thumb.jpg',
      url: '/media/full.jpg',
    })
    payloadMock.update.mockResolvedValue({ id: 'client-1' })

    const result = await uploadHeadshot('client-1', [1, 2, 3], 'image/jpeg', 'headshot.jpg')

    expect(result).toEqual({
      success: true,
      id: 'media-1',
      url: '/media/thumb.jpg',
    })
    expect(payloadMock.create).toHaveBeenCalledOnce()
    expect(payloadMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          alt: 'John Q. Public',
        }),
      }),
    )
    expect(payloadMock.update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'clients',
        id: 'client-1',
      }),
    )
  })

  it('updates an existing private-media headshot when existingHeadshotId is provided', async () => {
    payloadMock.update
      .mockResolvedValueOnce({
        id: 'media-9',
        thumbnailURL: '/media/replaced-thumb.jpg',
        url: '/media/replaced.jpg',
      })
      .mockResolvedValueOnce({ id: 'client-1' })

    const result = await uploadHeadshot(
      'client-1',
      [1, 2, 3],
      'image/jpeg',
      'replacement.jpg',
      'media-9',
    )

    expect(result).toEqual({
      success: true,
      id: 'media-9',
      url: '/media/replaced-thumb.jpg',
    })
    expect(payloadMock.create).not.toHaveBeenCalled()
    expect(payloadMock.update).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        collection: 'private-media',
        id: 'media-9',
        data: expect.objectContaining({
          alt: 'John Q. Public',
        }),
      }),
    )
    expect(payloadMock.update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        collection: 'clients',
        id: 'client-1',
      }),
    )
  })

  it('returns UPLOAD_FAILED and creates an admin alert when upload throws', async () => {
    payloadMock.create.mockRejectedValue(new Error('upload boom'))

    const result = await uploadHeadshot('client-1', [1, 2, 3], 'image/jpeg', 'headshot.jpg')

    expect(result.success).toBe(false)
    expect(result.errorCode).toBe('UPLOAD_FAILED')
    expect(result.error).toContain('upload boom')
    expect(vi.mocked(createAdminAlert)).toHaveBeenCalledOnce()
  })
})
