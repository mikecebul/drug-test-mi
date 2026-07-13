import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  assertRedwoodMutationAllowed,
  getAllowedRedwoodAccountNumbers,
  getRedwoodAccountNumber,
  getRedwoodAutomationRuntimeState,
  hasExhaustedRedwoodRetries,
  isRedwoodAccountAllowed,
  isRedwoodAutomationEnabled,
} from '@/lib/redwood/config'

describe('redwood config', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('defaults Redwood execution to account 310974', () => {
    expect(getRedwoodAccountNumber()).toBe('310974')
    expect(getAllowedRedwoodAccountNumbers()).toEqual(['310974'])
    expect(isRedwoodAccountAllowed('310974')).toBe(true)
  })

  it('blocks Redwood mutations outside the allowed account list', () => {
    vi.stubEnv('REDWOOD_ALLOWED_ACCOUNT_NUMBERS', '310974')

    expect(() => assertRedwoodMutationAllowed('310872', 'headshot upload')).toThrow('blocked for account 310872')
  })

  it('honors the explicit automation feature flag', () => {
    vi.stubEnv('REDWOOD_AUTOMATION_ENABLED', 'false')
    expect(isRedwoodAutomationEnabled()).toBe(false)
    expect(getRedwoodAutomationRuntimeState()).toEqual(
      expect.objectContaining({
        configured: true,
        configuredValue: 'false',
        enabled: false,
      }),
    )
    expect(() => assertRedwoodMutationAllowed('310974', 'import')).toThrow('Redwood import is disabled')

    vi.stubEnv('REDWOOD_AUTOMATION_ENABLED', ' TRUE ')
    expect(isRedwoodAutomationEnabled()).toBe(true)
    expect(getRedwoodAutomationRuntimeState()).toEqual(
      expect.objectContaining({
        configured: true,
        configuredValue: 'true',
        enabled: true,
      }),
    )
  })

  it('recognizes the final retry attempt', () => {
    expect(hasExhaustedRedwoodRetries(2)).toBe(false)
    expect(hasExhaustedRedwoodRetries(3)).toBe(true)
    expect(hasExhaustedRedwoodRetries(4)).toBe(true)
  })
})
