import { beforeEach, describe, expect, test, vi } from 'vitest'

import { fetchUpcomingScheduledCollections } from '@/lib/redwood/upcoming-scheduled-collections'
import {
  createGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
  listGoogleCalendarEvents,
} from '@/utilities/google-calendar-api'
import { getRandomTestingStart } from './calcom'
import { syncUpcomingRandomTestingPlaceholders } from './upcoming-schedule'

vi.mock('@/lib/redwood/upcoming-scheduled-collections', () => ({
  fetchUpcomingScheduledCollections: vi.fn(),
}))
vi.mock('@/utilities/google-calendar-api', () => ({
  createGoogleCalendarEvent: vi.fn(),
  deleteGoogleCalendarEvent: vi.fn(),
  listGoogleCalendarEvents: vi.fn(),
}))
vi.mock('./calcom', async (importOriginal) => {
  const original = await importOriginal<typeof import('./calcom')>()
  return {
    ...original,
    getRandomTestingStart: vi.fn(),
  }
})

describe('upcoming random-testing calendar sync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.RANDOM_TESTING_SCHEDULE_SYNC_ENABLED = 'true'
    vi.mocked(fetchUpcomingScheduledCollections).mockResolvedValue([
      { collectionDate: '2026-08-03', male: 1, female: 0, unspecified: 0, total: 1 },
      { collectionDate: '2026-08-04', male: 1, female: 1, unspecified: 0, total: 2 },
    ])
    vi.mocked(getRandomTestingStart).mockImplementation(async ({ collectionDate, slotIndex }) => ({
      start: `${collectionDate}T22:${String(slotIndex * 10).padStart(2, '0')}:00.000Z`,
      end: `${collectionDate}T22:${String(slotIndex * 10 + 10).padStart(2, '0')}:00.000Z`,
      timeZone: 'America/Detroit',
    }))
  })

  test('creates missing holds and deletes stale holds idempotently', async () => {
    vi.mocked(listGoogleCalendarEvents).mockResolvedValue([
      {
        id: 'existing',
        metadata: {
          source: 'toxaccess-random-testing',
          kind: 'placeholder',
          randomTestingReservationKey: '2026-08-03:0',
          collectionDate: '2026-08-03',
        },
      },
      {
        id: 'stale',
        metadata: {
          source: 'toxaccess-random-testing',
          kind: 'placeholder',
          randomTestingReservationKey: '2026-08-04:2',
          collectionDate: '2026-08-04',
        },
      },
    ])

    await expect(syncUpcomingRandomTestingPlaceholders()).resolves.toEqual({
      created: 2,
      cancelled: 1,
      days: 2,
      unchanged: 1,
    })
    expect(createGoogleCalendarEvent).toHaveBeenCalledTimes(2)
    expect(createGoogleCalendarEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        summary: 'Random Testing Hold 1',
        metadata: expect.objectContaining({
          randomTestingReservationKey: '2026-08-04:0',
        }),
      }),
    )
    expect(deleteGoogleCalendarEvent).toHaveBeenCalledWith('stale')
  })

  test('deletes a stale hold for a date that disappeared inside the current ToxAccess range', async () => {
    vi.mocked(fetchUpcomingScheduledCollections).mockResolvedValue([
      { collectionDate: '2026-08-03', male: 1, female: 0, unspecified: 0, total: 1 },
      { collectionDate: '2026-08-05', male: 0, female: 1, unspecified: 0, total: 1 },
    ])
    vi.mocked(listGoogleCalendarEvents).mockResolvedValue([
      {
        id: 'removed-date',
        metadata: {
          source: 'toxaccess-random-testing',
          kind: 'placeholder',
          randomTestingReservationKey: '2026-08-04:0',
          collectionDate: '2026-08-04',
        },
      },
    ])

    await syncUpcomingRandomTestingPlaceholders()

    expect(deleteGoogleCalendarEvent).toHaveBeenCalledWith('removed-date')
  })

  test('cleans up upcoming holds when ToxAccess reports no upcoming collections', async () => {
    vi.mocked(fetchUpcomingScheduledCollections).mockResolvedValue([])
    vi.mocked(listGoogleCalendarEvents).mockResolvedValue([
      {
        id: 'no-longer-upcoming',
        metadata: {
          source: 'toxaccess-random-testing',
          kind: 'placeholder',
          randomTestingReservationKey: '2026-08-03:0',
          collectionDate: '2026-08-03',
        },
      },
    ])

    await expect(syncUpcomingRandomTestingPlaceholders(new Date('2026-07-29T12:00:00.000Z'))).resolves.toEqual({
      created: 0,
      cancelled: 1,
      days: 0,
      unchanged: 0,
    })
    expect(deleteGoogleCalendarEvent).toHaveBeenCalledWith('no-longer-upcoming')
  })
})
