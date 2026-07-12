import { describe, expect, it } from 'vitest'

import { resolveConfiguredDefaultTestValue } from './20260712_000000_migrate_client_default_test_to_config_value'

describe('client default test config-value migration', () => {
  const legacyIdToValue = new Map([['507f1f77bcf86cd799439011', '11-panel-lab']])

  it('keeps canonical config values unchanged', () => {
    expect(resolveConfiguredDefaultTestValue('11-panel-lab', legacyIdToValue)).toBe('11-panel-lab')
  })

  it('maps legacy relationship IDs to config values', () => {
    expect(resolveConfiguredDefaultTestValue('507f1f77bcf86cd799439011', legacyIdToValue)).toBe('11-panel-lab')
    expect(resolveConfiguredDefaultTestValue({ toString: () => '507f1f77bcf86cd799439011' }, legacyIdToValue)).toBe(
      '11-panel-lab',
    )
  })

  it('does not preserve unknown relationship IDs as select values', () => {
    expect(resolveConfiguredDefaultTestValue('507f1f77bcf86cd799439099', legacyIdToValue)).toBeNull()
  })
})
