import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  canUseHeadedRedwoodBrowser,
  resolveRedwoodPlaywrightLaunchOptions,
} from '@/lib/redwood/playwright'

const originalPlatform = process.platform

function setProcessPlatform(value: NodeJS.Platform) {
  Object.defineProperty(process, 'platform', {
    configurable: true,
    value,
  })
}

describe('redwood playwright runtime policy', () => {
  afterEach(() => {
    setProcessPlatform(originalPlatform)
    delete process.env.DISPLAY
    delete process.env.WAYLAND_DISPLAY
    vi.restoreAllMocks()
  })

  it('forces job runtime to headless', () => {
    const launchOptions = resolveRedwoodPlaywrightLaunchOptions({
      runtimeProfile: 'job',
      slowMoMs: 250,
    })

    expect(launchOptions).toEqual({
      headless: true,
      runtimeProfile: 'job',
    })
  })

  it('allows dev-debug runtime when a display server is available', () => {
    setProcessPlatform('linux')
    process.env.DISPLAY = ':99'

    const launchOptions = resolveRedwoodPlaywrightLaunchOptions({
      runtimeProfile: 'dev-debug',
      slowMoMs: 200,
    })

    expect(launchOptions).toEqual({
      headless: false,
      runtimeProfile: 'dev-debug',
      slowMo: 200,
    })
    expect(canUseHeadedRedwoodBrowser()).toBe(true)
  })

  it('fails fast when dev-debug runtime has no display server', () => {
    setProcessPlatform('linux')

    expect(() =>
      resolveRedwoodPlaywrightLaunchOptions({
        runtimeProfile: 'dev-debug',
      }),
    ).toThrow('requires a display server')
    expect(canUseHeadedRedwoodBrowser()).toBe(false)
  })
})
