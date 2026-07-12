import { describe, expect, it, vi } from 'vitest'

import { down } from './20260701_000000_migrate_test_type_relationships_to_config_values'

describe('test type config-value rollback', () => {
  it('bypasses select validation when restoring legacy relationship IDs', async () => {
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

    await down({ payload } as never)

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
})
