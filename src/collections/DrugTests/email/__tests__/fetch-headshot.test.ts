import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { Payload } from 'payload'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { promises as fs } from 'fs'
import { fetchClientHeadshot } from '../fetch-headshot'

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: class {},
  GetObjectCommand: class {
    constructor(public input: unknown) {}
  },
}))
vi.mock('@aws-sdk/s3-request-presigner', () => ({ getSignedUrl: vi.fn() }))
vi.mock('fs', () => ({ promises: { access: vi.fn() } }))

function payload(headshot: unknown) {
  return {
    findByID: vi.fn().mockResolvedValue({ id: 'client-1', headshot }),
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  } as unknown as Payload
}
const portrait = {
  id: 'portrait-1',
  filename: 'portrait.webp',
  mimeType: 'image/webp',
  url: '/api/private-media/file/portrait.webp',
  sizes: { thumbnail: { filename: 'portrait-thumbnail.webp', mimeType: 'image/webp' } },
}

describe('email headshot preview policy', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('NEXT_PUBLIC_S3_HOSTNAME', '')
    vi.mocked(fs.access).mockResolvedValue(undefined)
    vi.mocked(getSignedUrl).mockResolvedValue('https://storage.example/expiring-headshot')
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.clearAllMocks()
  })

  test('development previews use the authenticated thumbnail endpoint without reading or publishing the file', async () => {
    vi.stubEnv('NEXT_PUBLIC_S3_HOSTNAME', 'storage.example')
    expect(await fetchClientHeadshot('client-1', payload(portrait), { preview: true })).toBe(
      '/api/private-media/file/portrait-thumbnail.webp',
    )
    expect(fs.access).not.toHaveBeenCalled()
    expect(getSignedUrl).not.toHaveBeenCalled()
  })

  test('preview falls back to the protected original when no thumbnail exists', async () => {
    expect(await fetchClientHeadshot('client-1', payload({ ...portrait, sizes: undefined }), { preview: true })).toBe(
      '/api/private-media/file/portrait.webp',
    )
  })

  test('local sent emails still omit the non-expiring development image URL', async () => {
    expect(await fetchClientHeadshot('client-1', payload(portrait))).toBeNull()
    expect(getSignedUrl).not.toHaveBeenCalled()
  })

  test('production previews and sends retain the existing expiring S3 URL', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('NEXT_PUBLIC_S3_HOSTNAME', 'storage.example')
    for (const preview of [true, false]) {
      expect(await fetchClientHeadshot('client-1', payload(portrait), { preview })).toBe(
        'https://storage.example/expiring-headshot',
      )
    }
    expect(getSignedUrl).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        input: expect.objectContaining({ Key: 'private/portrait-thumbnail.webp' }),
      }),
      { expiresIn: 604800 },
    )
    expect(fs.access).not.toHaveBeenCalled()
  })

  test.each([null, 'unpopulated-media-id', { ...portrait, mimeType: null }])(
    'missing/incomplete portraits keep the initials fallback',
    async (headshot) => {
      expect(await fetchClientHeadshot('client-1', payload(headshot), { preview: true })).toBeNull()
      expect(getSignedUrl).not.toHaveBeenCalled()
    },
  )
})
