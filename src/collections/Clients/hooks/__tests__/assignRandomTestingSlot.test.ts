import { describe, expect, test, vi } from 'vitest'

import { assignRandomTestingSlot } from '../assignRandomTestingSlot'

describe('assignRandomTestingSlot', () => {
  test('assigns the earliest unused slot when random testing is enabled', async () => {
    const find = vi.fn().mockResolvedValue({
      docs: [{ randomTestingSlotIndex: 0 }, { randomTestingSlotIndex: 2 }],
    })
    const data = await assignRandomTestingSlot({
      data: { randomTestingActive: true },
      operation: 'update',
      originalDoc: { id: 'client-3', randomTestingActive: false },
      req: { payload: { find } },
    } as never)

    expect(data).toMatchObject({
      randomTestingActive: true,
      randomTestingSlotIndex: 1,
      randomTestingWeekdayTime: '18:10',
      randomTestingWeekendTime: '11:00',
    })
  })

  test('preserves a client’s slot while random testing remains active', async () => {
    const find = vi.fn()
    const data = await assignRandomTestingSlot({
      data: { phone: '2315550100' },
      operation: 'update',
      originalDoc: {
        id: 'client-2',
        randomTestingActive: true,
        randomTestingSlotIndex: 1,
        randomTestingAssignedAt: '2026-07-01T12:00:00.000Z',
      },
      req: { payload: { find } },
    } as never)

    expect(data).toMatchObject({
      randomTestingSlotIndex: 1,
      randomTestingWeekdayTime: '18:10',
      randomTestingWeekendTime: '11:00',
      randomTestingAssignedAt: '2026-07-01T12:00:00.000Z',
    })
    expect(find).not.toHaveBeenCalled()
  })

  test('releases the slot without deactivating the client record', async () => {
    const data = await assignRandomTestingSlot({
      data: { randomTestingActive: false },
      operation: 'update',
      originalDoc: { id: 'client-1', randomTestingActive: true, isActive: true },
      req: { payload: { find: vi.fn() } },
    } as never)

    expect(data).toEqual({
      randomTestingActive: false,
      randomTestingSlotIndex: null,
      randomTestingWeekdayTime: null,
      randomTestingWeekendTime: null,
      randomTestingAssignedAt: null,
    })
    expect(data).not.toHaveProperty('isActive')
  })
})
