import { beforeEach, describe, expect, test, vi } from 'vitest'

import { getCalcomSchedule } from '@/utilities/calcom-api'
import { getRandomTestingStart } from './calcom'

vi.mock('@/utilities/calcom-api', () => ({
  getCalcomSchedule: vi.fn(),
}))

const mockedGetCalcomSchedule = vi.mocked(getCalcomSchedule)

describe('getRandomTestingStart', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.RANDOM_TESTING_CALCOM_SCHEDULE_ID
  })

  test('rounds weekend availability up to the ten-minute grid and applies the durable slot', async () => {
    mockedGetCalcomSchedule.mockResolvedValue({
      id: 1,
      timeZone: 'America/Detroit',
      availability: [
        {
          days: ['Sunday', 'Saturday'],
          startTime: '1970-01-01T10:45:00.000Z',
          endTime: '1970-01-01T11:45:00.000Z',
        },
      ],
      dateOverrides: [],
    })

    await expect(getRandomTestingStart({ collectionDate: '2026-08-02', slotIndex: 1 })).resolves.toEqual({
      start: '2026-08-02T15:00:00.000Z',
      end: '2026-08-02T15:10:00.000Z',
      timeZone: 'America/Detroit',
    })
  })

  test('uses a date override instead of recurring availability', async () => {
    mockedGetCalcomSchedule.mockResolvedValue({
      id: 1,
      timeZone: 'America/Detroit',
      availability: [{ days: ['Wednesday'], startTime: '18:00', endTime: '19:00' }],
      overrides: [{ date: '2026-07-29', startTime: '15:00', endTime: '16:00' }],
    })

    const result = await getRandomTestingStart({ collectionDate: '2026-07-29', slotIndex: 1 })
    expect(result.start).toBe('2026-07-29T19:10:00.000Z')
  })
})
