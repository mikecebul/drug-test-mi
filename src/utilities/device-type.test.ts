import { describe, expect, it } from 'vitest'

import { getDeviceType } from './device-type'

describe('getDeviceType', () => {
  it('recognizes iPadOS when Safari reports a desktop Mac user agent', () => {
    expect(
      getDeviceType({
        maxTouchPoints: 5,
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15',
        width: 1366,
      }),
    ).toBe('tablet')
  })

  it('uses viewport breakpoints when the user agent is inconclusive', () => {
    expect(getDeviceType({ width: 390 })).toBe('mobile')
    expect(getDeviceType({ width: 768 })).toBe('tablet')
    expect(getDeviceType({ width: 1440 })).toBe('desktop')
  })

  it('distinguishes Android phones from Android tablets', () => {
    expect(
      getDeviceType({
        userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Mobile',
        width: 412,
      }),
    ).toBe('mobile')
    expect(
      getDeviceType({
        userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36',
        width: 1280,
      }),
    ).toBe('tablet')
  })
})
