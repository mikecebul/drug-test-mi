import { beforeEach, describe, expect, test, vi } from 'vitest'

import { getCalcomEventType, getCalcomSchedule } from '@/utilities/calcom-api'
import {
  getRandomTestingCalcomEventTypeId,
  getRandomTestingStart,
  getValidatedRandomTestingCalcomEventType,
} from './calcom'

vi.mock('@/utilities/calcom-api', () => ({
  getCalcomEventType: vi.fn(),
  getCalcomSchedule: vi.fn(),
}))

const mockedGetCalcomSchedule = vi.mocked(getCalcomSchedule)
const mockedGetCalcomEventType = vi.mocked(getCalcomEventType)

describe('getRandomTestingStart', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.RANDOM_TESTING_CALCOM_EVENT_TYPE_ID
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

describe('random-testing Cal.com event type', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.RANDOM_TESTING_CALCOM_EVENT_TYPE_ID
    delete process.env.RANDOM_TESTING_CALCOM_SCHEDULE_ID
  })

  test('defaults to the unpaid drug-test event type', () => {
    expect(getRandomTestingCalcomEventTypeId()).toBe(3684719)
  })

  test('validates price, duration, and configured schedule', async () => {
    process.env.RANDOM_TESTING_CALCOM_SCHEDULE_ID = '840279'
    mockedGetCalcomEventType.mockResolvedValue({
      id: 3684719,
      lengthInMinutes: 10,
      price: 0,
      scheduleId: 840279,
    })

    await expect(getValidatedRandomTestingCalcomEventType()).resolves.toMatchObject({
      id: 3684719,
      price: 0,
      scheduleId: 840279,
    })
    expect(mockedGetCalcomEventType).toHaveBeenCalledWith({
      eventSlug: 'drug-test',
      eventTypeId: 3684719,
      username: 'midrugtest',
    })
  })

  test('rejects a paid event type', async () => {
    mockedGetCalcomEventType.mockResolvedValue({
      id: 3684719,
      lengthInMinutes: 10,
      price: 35,
    })

    await expect(getValidatedRandomTestingCalcomEventType()).rejects.toThrow('must be explicitly unpaid')
  })

  test('accepts an event type when the list response omits its schedule ID', async () => {
    process.env.RANDOM_TESTING_CALCOM_SCHEDULE_ID = '840279'
    mockedGetCalcomEventType.mockResolvedValue({
      id: 3684719,
      lengthInMinutes: 10,
      price: 0,
    })

    await expect(getValidatedRandomTestingCalcomEventType()).resolves.toMatchObject({
      id: 3684719,
      price: 0,
    })
  })

  test('rejects a different schedule ID when Cal.com returns one', async () => {
    process.env.RANDOM_TESTING_CALCOM_SCHEDULE_ID = '840279'
    mockedGetCalcomEventType.mockResolvedValue({
      id: 3684719,
      lengthInMinutes: 10,
      price: 0,
      scheduleId: 123,
    })

    await expect(getValidatedRandomTestingCalcomEventType()).rejects.toThrow(
      'uses schedule 123, not RANDOM_TESTING_CALCOM_SCHEDULE_ID 840279',
    )
  })
})
