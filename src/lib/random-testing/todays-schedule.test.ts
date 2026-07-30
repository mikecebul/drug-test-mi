import { beforeEach, describe, expect, test, vi } from 'vitest'

import { fetchTodaysScheduledCollections } from '@/lib/redwood/scheduled-collections'
import {
  createGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
  listGoogleCalendarEvents,
  updateGoogleCalendarEvent,
} from '@/utilities/google-calendar-api'
import { getRandomTestingStart } from './calcom'
import { syncTodaysScheduledCollections } from './todays-schedule'

vi.mock('@/lib/redwood/scheduled-collections', () => ({
  fetchTodaysScheduledCollections: vi.fn(),
}))
vi.mock('@/utilities/google-calendar-api', () => ({
  createGoogleCalendarEvent: vi.fn(),
  deleteGoogleCalendarEvent: vi.fn(),
  getGoogleCalendarConfig: vi.fn(() => ({
    organizerEmail: 'mike@midrugtest.com',
    organizerName: 'MI Drug Test',
  })),
  listGoogleCalendarEvents: vi.fn(),
  updateGoogleCalendarEvent: vi.fn(),
}))
vi.mock('./calcom', async (importOriginal) => {
  const original = await importOriginal<typeof import('./calcom')>()
  return {
    ...original,
    getRandomTestingStart: vi.fn(),
  }
})
vi.mock('@/utilities/revalidateBookingViews', () => ({
  revalidateBookingViews: vi.fn(),
}))

describe("today's random-testing schedule sync", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.RANDOM_TESTING_SCHEDULE_SYNC_ENABLED = 'true'
    vi.mocked(fetchTodaysScheduledCollections).mockResolvedValue([
      {
        agency: 'MI Drug Test',
        donorGroup: 'Random',
        donorId: '2749795',
        donorName: 'Cameron Vanatta',
        testType: 'Random',
      },
    ])
    vi.mocked(getRandomTestingStart).mockResolvedValue({
      start: '2026-07-29T22:00:00.000Z',
      end: '2026-07-29T22:10:00.000Z',
      timeZone: 'America/Detroit',
    })
  })

  test('replaces the hold in place and stores the Google event in Today’s Schedule', async () => {
    vi.mocked(listGoogleCalendarEvents).mockResolvedValue([
      {
        id: 'google-event-1',
        metadata: {
          source: 'toxaccess-random-testing',
          kind: 'placeholder',
          randomTestingReservationKey: '2026-07-29:0',
        },
      },
    ])
    vi.mocked(updateGoogleCalendarEvent).mockResolvedValue({
      id: 'google-event-1',
      start: '2026-07-29T22:00:00.000Z',
      end: '2026-07-29T22:10:00.000Z',
      metadata: {
        source: 'toxaccess-random-testing',
        kind: 'scheduled-collection',
        toxaccessCollectionKey: '2026-07-29:2749795',
      },
    })

    const payload = {
      find: vi
        .fn()
        .mockResolvedValueOnce({
          docs: [
            {
              id: 'client-1',
              firstName: 'Cameron',
              lastName: 'Vanatta',
              email: 'cameron@example.com',
              randomTestingActive: true,
              randomTestingSlotIndex: 0,
              redwoodDonorId: '2749795',
            },
          ],
        })
        .mockResolvedValueOnce({ docs: [] })
        .mockResolvedValueOnce({ docs: [] }),
      findByID: vi.fn().mockResolvedValue({
        id: 'client-1',
        firstName: 'Cameron',
        lastName: 'Vanatta',
        email: 'cameron@example.com',
        randomTestingActive: true,
        randomTestingSlotIndex: 0,
      }),
      create: vi.fn().mockResolvedValue({ id: 'payload-booking-1' }),
      update: vi.fn(),
    }

    await expect(
      syncTodaysScheduledCollections(payload as never, new Date('2026-07-29T12:00:00.000Z')),
    ).resolves.toMatchObject({
      results: [
        {
          bookingId: 'payload-booking-1',
          collectionKey: '2026-07-29:2749795',
          placeholderReplaced: true,
          status: 'materialized',
        },
      ],
    })
    expect(updateGoogleCalendarEvent).toHaveBeenCalledWith({
      eventId: 'google-event-1',
      event: expect.objectContaining({
        summary: 'Random Drug Test - Cameron Vanatta',
        remindersUseDefault: true,
        metadata: expect.objectContaining({
          toxaccessDonorId: '2749795',
        }),
      }),
    })
    expect(createGoogleCalendarEvent).not.toHaveBeenCalled()
    expect(deleteGoogleCalendarEvent).not.toHaveBeenCalled()
    expect(payload.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          googleCalendarEventId: 'google-event-1',
          attendeeName: 'Cameron Vanatta',
          toxaccessDonorId: '2749795',
        }),
      }),
    )
  })
})
