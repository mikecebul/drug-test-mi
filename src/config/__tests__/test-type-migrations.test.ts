import { describe, expect, it, vi } from 'vitest'

import { down as rollbackReferralTestTypes } from '@/migrations/20260701_000000_migrate_test_type_relationships_to_config_values'
import { resolveConfiguredDefaultTestValue } from '@/migrations/20260712_000000_migrate_client_default_test_to_config_value'

describe('test type config-value migrations', () => {
  it('bypasses select validation when restoring legacy referral relationship IDs', async () => {
    const updateMany = vi.fn().mockResolvedValue({ modifiedCount: 1 })
    const payload = {
      find: vi.fn().mockResolvedValue({
        docs: [{ id: '507f1f77bcf86cd799439011', value: '11-panel-lab' }],
      }),
      db: {
        collections: {
          courts: { collection: { updateMany } },
          employers: { collection: { updateMany } },
          bookings: { collection: { updateMany } },
        },
      },
      logger: {
        info: vi.fn(),
      },
    }

    await rollbackReferralTestTypes({ payload } as never)

    expect(updateMany).toHaveBeenCalledTimes(3)
    expect(updateMany).toHaveBeenCalledWith(
      { preferredTestType: '11-panel-lab' },
      { $set: { preferredTestType: '507f1f77bcf86cd799439011' } },
    )
    expect(updateMany).toHaveBeenCalledWith(
      { scheduledTestType: '11-panel-lab' },
      { $set: { scheduledTestType: '507f1f77bcf86cd799439011' } },
    )
  })

  describe('client default test conversion', () => {
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
})
