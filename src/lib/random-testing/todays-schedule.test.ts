import { beforeEach, describe, expect, test, vi } from 'vitest'

import { fetchTodaysScheduledCollections } from '@/lib/redwood/scheduled-collections'
import { createCalcomBooking, listCalcomBookings } from '@/utilities/calcom-api'
import { deleteGoogleCalendarEvent, listGoogleCalendarEvents } from '@/utilities/google-calendar-api'
import { getRandomTestingStart, getValidatedRandomTestingCalcomEventType } from './calcom'
import { syncTodaysScheduledCollections } from './todays-schedule'

vi.mock('@/lib/redwood/scheduled-collections', () => ({
  fetchTodaysScheduledCollections: vi.fn(),
}))
vi.mock('@/utilities/calcom-api', () => ({
  createCalcomBooking: vi.fn(),
  listCalcomBookings: vi.fn(),
}))
vi.mock('@/utilities/google-calendar-api', () => ({
  deleteGoogleCalendarEvent: vi.fn(),
  listGoogleCalendarEvents: vi.fn(),
}))
vi.mock('./calcom', async (importOriginal) => {
  const original = await importOriginal<typeof import('./calcom')>()
  return {
    ...original,
    getRandomTestingStart: vi.fn(),
    getValidatedRandomTestingCalcomEventType: vi.fn(),
  }
})
const placeholder = {
  id: 'google-event-1',
  metadata: {
    source: 'toxaccess-random-testing',
    kind: 'placeholder',
    randomTestingReservationKey: '2026-07-29:0',
  },
}

const calcomBooking = {
  id: 12345,
  uid: 'cal-booking-1',
  title: 'Drug Test',
  start: '2026-07-29T22:00:00.000Z',
  end: '2026-07-29T22:10:00.000Z',
  eventTypeId: 3684719,
  location: 'MI Drug Test',
  hosts: [
    {
      id: 77,
      name: 'MI Drug Test',
      email: 'mike@midrugtest.com',
      timeZone: 'America/Detroit',
    },
  ],
  metadata: {
    source: 'toxaccess-random-testing',
    toxaccessCollectionKey: '2026-07-29:1234567',
  },
}

function createPayload(existingBooking: Record<string, unknown> | null = null) {
  return {
    find: vi
      .fn()
      .mockResolvedValueOnce({
        docs: [
          {
            id: 'client-1',
            firstName: 'Example',
            lastName: 'Donor',
            email: 'donor@example.com',
            phone: '(231) 555-1212',
            defaultTestType: '17-panel-instant',
            randomTestingActive: true,
            randomTestingSlotIndex: 0,
            redwoodDonorId: '1234567',
          },
        ],
      })
      .mockResolvedValueOnce({ docs: [] })
      .mockResolvedValueOnce({ docs: existingBooking ? [existingBooking] : [] }),
    findByID: vi.fn().mockResolvedValue({
      id: 'client-1',
      firstName: 'Example',
      lastName: 'Donor',
      email: 'donor@example.com',
      phone: '(231) 555-1212',
      defaultTestType: '17-panel-instant',
      randomTestingActive: true,
      randomTestingSlotIndex: 0,
    }),
    create: vi.fn().mockResolvedValue({ id: 'payload-booking-1' }),
    update: vi.fn().mockResolvedValue({ id: 'payload-booking-1' }),
  }
}

describe("today's random-testing schedule sync", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.RANDOM_TESTING_SCHEDULE_SYNC_ENABLED = 'true'
    vi.mocked(fetchTodaysScheduledCollections).mockResolvedValue([
      {
        agency: 'MI Drug Test',
        donorGroup: 'Random',
        donorId: '1234567',
        donorName: 'Example Donor',
        testType: 'Random',
      },
    ])
    vi.mocked(getRandomTestingStart).mockResolvedValue({
      start: '2026-07-29T22:00:00.000Z',
      end: '2026-07-29T22:10:00.000Z',
      timeZone: 'America/Detroit',
    })
    vi.mocked(getValidatedRandomTestingCalcomEventType).mockResolvedValue({
      id: 3684719,
      slug: 'drug-test',
      title: 'Drug Test',
      lengthInMinutes: 10,
      price: 0,
      scheduleId: 840279,
    })
    vi.mocked(listGoogleCalendarEvents).mockResolvedValue([placeholder])
    vi.mocked(listCalcomBookings).mockResolvedValue([])
    vi.mocked(createCalcomBooking).mockResolvedValue(calcomBooking)
    vi.mocked(deleteGoogleCalendarEvent).mockResolvedValue()
  })

  test('creates an unpaid Cal.com booking, adds Today’s Schedule, then deletes the hold', async () => {
    const payload = createPayload()

    await expect(
      syncTodaysScheduledCollections(payload as never, new Date('2026-07-29T12:00:00.000Z')),
    ).resolves.toMatchObject({
      results: [
        {
          bookingId: 'payload-booking-1',
          calcomBookingUid: 'cal-booking-1',
          collectionKey: '2026-07-29:1234567',
          placeholderCancelled: true,
          status: 'materialized',
        },
      ],
    })
    expect(createCalcomBooking).toHaveBeenCalledWith({
      attendee: {
        name: 'Example Donor',
        email: 'donor@example.com',
        phoneNumber: '+12315551212',
        language: 'en',
        timeZone: 'America/Detroit',
      },
      bookingFieldsResponses: {
        test: '17 Panel Instant',
        title: 'MI Drug Test',
      },
      eventTypeId: 3684719,
      metadata: {
        source: 'toxaccess-random-testing',
        kind: 'scheduled-collection',
        randomTestingReservationKey: '2026-07-29:0',
        toxaccessCollectionKey: '2026-07-29:1234567',
        toxaccessDonorId: '1234567',
        collectionDate: '2026-07-29',
        paymentStatus: 'unpaid',
      },
      start: '2026-07-29T22:00:00.000Z',
    })
    expect(payload.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          attendeeName: 'Example Donor',
          calcomBookingId: 'cal-booking-1',
          calcomBookingNumericId: 12345,
          eventTypeId: 3684719,
          payment: expect.objectContaining({
            amountPaid: 0,
            method: 'not-paid',
            status: 'unpaid',
          }),
          toxaccessDonorId: '1234567',
        }),
      }),
    )
    expect(deleteGoogleCalendarEvent).toHaveBeenCalledWith('google-event-1')
    expect(payload.create.mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(deleteGoogleCalendarEvent).mock.invocationCallOrder[0],
    )
  })

  test('reuses an existing matching Cal.com booking on retry', async () => {
    vi.mocked(listCalcomBookings).mockResolvedValue([calcomBooking])
    const payload = createPayload({
      id: 'payload-booking-1',
      calcomBookingId: 'cal-booking-1',
      createdViaWebhook: true,
    })

    const result = await syncTodaysScheduledCollections(payload as never, new Date('2026-07-29T12:00:00.000Z'))

    expect(result.results[0]).toMatchObject({
      bookingId: 'payload-booking-1',
      calcomBookingUid: 'cal-booking-1',
      placeholderCancelled: true,
      status: 'materialized',
    })
    expect(createCalcomBooking).not.toHaveBeenCalled()
    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          calcomBookingId: 'cal-booking-1',
          createdViaWebhook: true,
        }),
      }),
    )
  })

  test('keeps the placeholder when creating the Cal.com booking fails', async () => {
    vi.mocked(createCalcomBooking).mockRejectedValue(new Error('Cal.com unavailable'))
    const payload = createPayload()

    const result = await syncTodaysScheduledCollections(payload as never, new Date('2026-07-29T12:00:00.000Z'))

    expect(result.results[0]).toMatchObject({
      error: 'Cal.com unavailable',
      status: 'failed',
    })
    expect(payload.create).not.toHaveBeenCalled()
    expect(deleteGoogleCalendarEvent).not.toHaveBeenCalled()
  })

  test('recovers when the Cal.com webhook creates Today’s Schedule concurrently', async () => {
    const payload = createPayload()
    payload.create.mockRejectedValue(
      Object.assign(new Error('E11000 duplicate key error'), {
        code: 11000,
      }),
    )
    payload.find.mockResolvedValueOnce({
      docs: [
        {
          id: 'payload-booking-1',
          calcomBookingId: 'cal-booking-1',
          createdViaWebhook: true,
        },
      ],
    })

    const result = await syncTodaysScheduledCollections(payload as never, new Date('2026-07-29T12:00:00.000Z'))

    expect(result.results[0]).toMatchObject({
      bookingId: 'payload-booking-1',
      status: 'materialized',
    })
    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'payload-booking-1',
        data: expect.objectContaining({ createdViaWebhook: true }),
      }),
    )
    expect(deleteGoogleCalendarEvent).toHaveBeenCalledWith('google-event-1')
  })
})
