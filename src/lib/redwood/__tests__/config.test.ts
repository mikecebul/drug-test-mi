import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  assertRedwoodMutationAllowed,
  getAllowedRedwoodAccountNumbers,
  getRedwoodAccountNumber,
  isRedwoodAccountAllowed,
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
})
