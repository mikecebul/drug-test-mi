import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const googleMocks = vi.hoisted(() => ({
  calendarFactory: vi.fn(),
  delete: vi.fn(),
  insert: vi.fn(),
  jwt: vi.fn(),
  list: vi.fn(),
  patch: vi.fn(),
}))

vi.mock('googleapis', () => ({
  google: {
    auth: {
      JWT: googleMocks.jwt,
    },
    calendar: googleMocks.calendarFactory,
  },
}))

import {
  createGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
  listGoogleCalendarEvents,
  updateGoogleCalendarEvent,
} from './google-calendar-api'

describe('Google Calendar API helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.GOOGLE_CALENDAR_ID = 'mike@midrugtest.com'
    process.env.GOOGLE_CALENDAR_SERVICE_ACCOUNT_EMAIL = 'calendar-writer@example.iam.gserviceaccount.com'
    process.env.GOOGLE_CALENDAR_SERVICE_ACCOUNT_PRIVATE_KEY = 'line-one\\nline-two'
    googleMocks.calendarFactory.mockReturnValue({
      events: {
        delete: googleMocks.delete,
        insert: googleMocks.insert,
        list: googleMocks.list,
        patch: googleMocks.patch,
      },
    })
  })

  afterEach(() => {
    delete process.env.GOOGLE_CALENDAR_ID
    delete process.env.GOOGLE_CALENDAR_SERVICE_ACCOUNT_EMAIL
    delete process.env.GOOGLE_CALENDAR_SERVICE_ACCOUNT_PRIVATE_KEY
    delete process.env.GOOGLE_CALENDAR_IMPERSONATED_USER
  })

  test('creates a private busy event without attendees or notifications', async () => {
    googleMocks.insert.mockResolvedValue({
      data: {
        id: 'event-1',
        start: { dateTime: '2026-08-03T22:00:00.000Z' },
        end: { dateTime: '2026-08-03T22:10:00.000Z' },
        extendedProperties: { private: { source: 'toxaccess-random-testing' } },
      },
    })

    await createGoogleCalendarEvent({
      summary: 'Random Testing Hold 1',
      start: '2026-08-03T22:00:00.000Z',
      end: '2026-08-03T22:10:00.000Z',
      timeZone: 'America/Detroit',
      metadata: { source: 'toxaccess-random-testing' },
    })

    expect(googleMocks.jwt).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'calendar-writer@example.iam.gserviceaccount.com',
        key: 'line-one\nline-two',
        scopes: ['https://www.googleapis.com/auth/calendar.events'],
      }),
    )
    expect(googleMocks.insert).toHaveBeenCalledWith({
      calendarId: 'mike@midrugtest.com',
      requestBody: expect.objectContaining({
        reminders: { useDefault: false },
        transparency: 'opaque',
        visibility: 'private',
      }),
      sendUpdates: 'none',
    })
    const [{ requestBody }] = googleMocks.insert.mock.calls[0]
    expect(requestBody).not.toHaveProperty('attendees')
  })

  test('walks event pagination and preserves private metadata', async () => {
    googleMocks.list
      .mockResolvedValueOnce({
        data: {
          items: [
            {
              id: 'event-1',
              summary: 'First',
              extendedProperties: { private: { kind: 'placeholder' } },
            },
          ],
          nextPageToken: 'next-page',
        },
      })
      .mockResolvedValueOnce({
        data: {
          items: [{ id: 'event-2', summary: 'Second' }],
        },
      })

    await expect(
      listGoogleCalendarEvents({
        timeMin: '2026-08-03T04:00:00.000Z',
        timeMax: '2026-08-04T04:00:00.000Z',
        privateExtendedProperties: ['source=toxaccess-random-testing'],
      }),
    ).resolves.toEqual([
      expect.objectContaining({ id: 'event-1', metadata: { kind: 'placeholder' } }),
      expect.objectContaining({ id: 'event-2', metadata: {} }),
    ])
    expect(googleMocks.list).toHaveBeenNthCalledWith(2, expect.objectContaining({ pageToken: 'next-page' }))
  })

  test('patches and deletes events without sending guest updates', async () => {
    googleMocks.patch.mockResolvedValue({
      data: {
        id: 'event-1',
        summary: 'Random Drug Test - Example Donor',
      },
    })
    googleMocks.delete.mockResolvedValue({ data: {} })

    await updateGoogleCalendarEvent({
      eventId: 'event-1',
      event: {
        summary: 'Random Drug Test - Example Donor',
        start: '2026-08-03T22:00:00.000Z',
        end: '2026-08-03T22:10:00.000Z',
        timeZone: 'America/Detroit',
        remindersUseDefault: true,
        metadata: { kind: 'scheduled-collection' },
      },
    })
    await deleteGoogleCalendarEvent('event-1')

    expect(googleMocks.patch).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: 'event-1',
        requestBody: expect.objectContaining({ reminders: { useDefault: true } }),
        sendUpdates: 'none',
      }),
    )
    expect(googleMocks.delete).toHaveBeenCalledWith({
      calendarId: 'mike@midrugtest.com',
      eventId: 'event-1',
      sendUpdates: 'none',
    })
  })
})
