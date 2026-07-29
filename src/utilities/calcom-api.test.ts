import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { createCalcomBooking, listCalcomBookings } from './calcom-api'

describe('Cal.com API helpers', () => {
  beforeEach(() => {
    process.env.CAL_API_KEY = 'cal_test_example'
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    delete process.env.CAL_API_KEY
  })

  test('creates host-authorized conflicting bookings with the current API version', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            id: 1,
            uid: 'booking-1',
            title: 'Random Test',
            start: '2026-07-29T22:00:00.000Z',
            end: '2026-07-29T22:10:00.000Z',
          },
        }),
        { status: 201 },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    await createCalcomBooking({
      attendee: {
        name: 'Example Donor',
        email: 'calendar@example.com',
        timeZone: 'America/Detroit',
      },
      eventTypeId: 123,
      metadata: { source: 'toxaccess-random-testing' },
      start: '2026-07-29T22:00:00.000Z',
    })

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(new Headers(init.headers).get('cal-api-version')).toBe('2026-02-25')
    expect(JSON.parse(String(init.body))).toMatchObject({
      allowConflicts: true,
      allowBookingOutOfBounds: true,
      skipBookingLimits: true,
    })
  })

  test('walks cursor pagination with the current bookings API', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [{ id: 1, uid: 'one', title: 'One', start: 'a', end: 'b' }],
            pagination: { hasMore: true, nextCursor: 'opaque-next' },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [{ id: 2, uid: 'two', title: 'Two', start: 'c', end: 'd' }],
            pagination: { hasMore: false, nextCursor: null },
          }),
          { status: 200 },
        ),
      )
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      listCalcomBookings({
        afterStart: '2026-07-29T04:00:00.000Z',
        beforeEnd: '2026-07-30T04:00:00.000Z',
      }),
    ).resolves.toHaveLength(2)

    expect(String(fetchMock.mock.calls[0][0])).toContain('limit=100')
    expect(String(fetchMock.mock.calls[1][0])).toContain('cursor=opaque-next')
  })
})
