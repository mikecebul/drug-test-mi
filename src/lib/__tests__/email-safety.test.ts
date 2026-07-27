import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  filterNonLiveBlockedRecipients,
  getEmailTestAddress,
  isNonLiveEmailMode,
  resolveOutboundNotificationRecipients,
} from '@/lib/email-safety'

describe('email safety helpers', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('uses non-live email mode when the public live flag is false', () => {
    vi.stubEnv('NEXT_PUBLIC_IS_LIVE', 'false')

    expect(isNonLiveEmailMode()).toBe(true)
  })

  it('blocks Tom in non-live environments before redirecting to the test inbox', () => {
    vi.stubEnv('NEXT_PUBLIC_IS_LIVE', 'false')
    vi.stubEnv('EMAIL_TEST_ADDRESS', 'mike@midrugtest.com')

    const resolved = resolveOutboundNotificationRecipients(['mike@midrugtest.com', 'tom@midrugtest.com'])

    expect(filterNonLiveBlockedRecipients(['mike@midrugtest.com', 'tom@midrugtest.com'])).toEqual([
      'mike@midrugtest.com',
    ])
    expect(resolved).toEqual(
      expect.objectContaining({
        redirected: true,
        recipients: ['mike@midrugtest.com'],
        originalRecipients: ['mike@midrugtest.com'],
      }),
    )
  })

  it('preserves unique recipients in live mode', () => {
    vi.stubEnv('NEXT_PUBLIC_IS_LIVE', 'true')
    vi.stubEnv('EMAIL_TEST_MODE', 'false')

    expect(resolveOutboundNotificationRecipients(['a@example.com', 'A@example.com', 'tom@midrugtest.com'])).toEqual(
      expect.objectContaining({
        redirected: false,
        recipients: ['a@example.com', 'tom@midrugtest.com'],
      }),
    )
  })

  it('falls back when the configured test inbox is blocklisted', () => {
    vi.stubEnv('EMAIL_TEST_ADDRESS', 'tom@midrugtest.com')

    expect(getEmailTestAddress()).toBe('mike@midrugtest.com')
  })
})
