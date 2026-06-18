import crypto from 'crypto'
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import type { CalcomWebhookPayload } from '../calcomWebhook'
import { POST } from '../route'

const mocks = vi.hoisted(() => ({
  getPayload: vi.fn(),
  revalidateBookingViews: vi.fn(),
}))

vi.mock('payload', () => ({
  getPayload: mocks.getPayload,
}))

vi.mock('@payload-config', () => ({
  default: {},
}))

vi.mock('@/utilities/revalidateBookingViews', () => ({
  revalidateBookingViews: mocks.revalidateBookingViews,
}))

type MockBooking = {
  id: string
  calcomBookingId?: string | null
  calcomBookingNumericId?: number | null
  payment?: null
  startTime?: string
  endTime?: string
  attendeeName?: string
  attendeeEmail?: string
}

function createWebhook(overrides: Partial<CalcomWebhookPayload> = {}): CalcomWebhookPayload {
  const payload: CalcomWebhookPayload['payload'] = {
    id: 12345,
    uid: 'booking-new',
    title: 'Drug Test Appointment',
    type: 'drug-test',
    startTime: '2026-06-17T14:00:00.000Z',
    endTime: '2026-06-17T14:15:00.000Z',
    organizer: {
      id: 12,
      name: 'MI Drug Test',
      email: 'team@midrugtest.com',
    },
    responses: {
      name: {
        label: 'Name',
        value: 'Taylor Client',
      },
      email: {
        label: 'Email',
        value: 'taylor@example.com',
      },
    },
    attendees: [
      {
        name: 'Taylor Client',
        email: 'taylor@example.com',
      },
    ],
    ...overrides.payload,
  }

  return {
    triggerEvent: 'BOOKING_CREATED',
    createdAt: '2026-06-17T12:00:00.000Z',
    ...overrides,
    payload,
  }
}

function createRequest(webhook: CalcomWebhookPayload, secret?: string) {
  const body = JSON.stringify(webhook)
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  }

  if (secret) {
    headers['x-cal-signature-256'] = crypto.createHmac('sha256', secret).update(body).digest('hex')
  }

  return new NextRequest('http://localhost/api/webhooks/calcom', {
    method: 'POST',
    body,
    headers,
  })
}

function createPayloadMock(options: {
  find?: ReturnType<typeof vi.fn>
  create?: ReturnType<typeof vi.fn>
  update?: ReturnType<typeof vi.fn>
} = {}) {
  const payload = {
    find: options.find || vi.fn().mockResolvedValue({ docs: [] }),
    create: options.create || vi.fn().mockResolvedValue({ id: 'booking-created' }),
    update: options.update || vi.fn().mockResolvedValue({ id: 'booking-updated' }),
  }

  mocks.getPayload.mockResolvedValue(payload)
  return payload
}

function findByBookings(bookings: MockBooking[]) {
  return vi.fn().mockImplementation(({ where }: { where: Record<string, { equals: unknown }> }) => {
    const uid = where.calcomBookingId?.equals
    const numericId = where.calcomBookingNumericId?.equals
    const booking = bookings.find((candidate) => {
      if (uid !== undefined) return candidate.calcomBookingId === uid
      if (numericId !== undefined) return candidate.calcomBookingNumericId === numericId
      return false
    })

    return Promise.resolve({ docs: booking ? [booking] : [] })
  })
}

async function json(response: Response) {
  return response.json() as Promise<Record<string, unknown>>
}

describe('Cal.com webhook route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.CAL_WEBHOOK_SECRET
    delete process.env.CALCOM_WEBHOOK_SECRET
  })

  test('creates a booking for a new BOOKING_CREATED event', async () => {
    const payload = createPayloadMock()

    const response = await POST(createRequest(createWebhook()))

    expect(response.status).toBe(201)
    expect(await json(response)).toMatchObject({ message: 'Booking created', id: 'booking-created' })
    expect(payload.create).toHaveBeenCalledOnce()
    expect(payload.update).not.toHaveBeenCalled()
  })

  test('updates an existing booking found by Cal.com UID', async () => {
    const payload = createPayloadMock({
      find: findByBookings([{ id: 'existing-booking', calcomBookingId: 'booking-new' }]),
      update: vi.fn().mockResolvedValue({ id: 'existing-booking' }),
    })

    const response = await POST(createRequest(createWebhook()))

    expect(response.status).toBe(200)
    expect(await json(response)).toMatchObject({ message: 'Booking updated', id: 'existing-booking' })
    expect(payload.create).not.toHaveBeenCalled()
    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'bookings',
        id: 'existing-booking',
        data: expect.objectContaining({ calcomBookingId: 'booking-new' }),
        overrideAccess: true,
      }),
    )
  })

  test('ignores unhandled events before loading Payload', async () => {
    const response = await POST(createRequest(createWebhook({ triggerEvent: 'MEETING_STARTED' })))

    expect(response.status).toBe(200)
    expect(await json(response)).toMatchObject({ message: 'Event type not handled' })
    expect(mocks.getPayload).not.toHaveBeenCalled()
  })

  test('rejects invalid signatures before loading Payload', async () => {
    process.env.CAL_WEBHOOK_SECRET = 'webhook-secret'

    const response = await POST(createRequest(createWebhook(), 'different-secret'))

    expect(response.status).toBe(401)
    expect(await json(response)).toMatchObject({ error: 'Invalid signature' })
    expect(mocks.getPayload).not.toHaveBeenCalled()
  })

  test('updates an existing booking for cancellation events', async () => {
    const payload = createPayloadMock({
      find: findByBookings([{ id: 'existing-booking', calcomBookingId: 'booking-new' }]),
      update: vi.fn().mockResolvedValue({ id: 'existing-booking' }),
    })

    const response = await POST(createRequest(createWebhook({ triggerEvent: 'BOOKING_CANCELLED' })))

    expect(response.status).toBe(200)
    expect(await json(response)).toMatchObject({ message: 'Booking status updated', id: 'existing-booking' })
    expect(payload.create).not.toHaveBeenCalled()
    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'existing-booking',
        data: expect.objectContaining({ status: 'cancelled' }),
      }),
    )
  })

  test('marks the original booking rescheduled and updates the new booking', async () => {
    const payload = createPayloadMock({
      find: findByBookings([
        { id: 'new-booking', calcomBookingId: 'booking-new' },
        { id: 'original-booking', calcomBookingId: 'booking-original' },
      ]),
      update: vi
        .fn()
        .mockResolvedValueOnce({ id: 'original-booking' })
        .mockResolvedValueOnce({ id: 'new-booking' }),
    })

    const response = await POST(
      createRequest(
        createWebhook({
          triggerEvent: 'BOOKING_RESCHEDULED',
          payload: {
            uid: 'booking-new',
            rescheduleUid: 'booking-original',
          },
        }),
      ),
    )

    expect(response.status).toBe(200)
    expect(await json(response)).toMatchObject({ message: 'Booking rescheduled', id: 'new-booking' })
    expect(payload.update).toHaveBeenCalledTimes(2)
    expect(payload.update).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        id: 'original-booking',
        data: expect.objectContaining({ status: 'rescheduled' }),
      }),
    )
    expect(payload.update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        id: 'new-booking',
        data: expect.objectContaining({ calcomBookingId: 'booking-new' }),
      }),
    )
  })

  test('recovers duplicate create races by updating the row found on retry', async () => {
    const find = vi
      .fn()
      .mockResolvedValueOnce({ docs: [] })
      .mockResolvedValueOnce({ docs: [] })
      .mockResolvedValueOnce({ docs: [{ id: 'existing-after-race', calcomBookingId: 'booking-new' }] })
    const payload = createPayloadMock({
      find,
      create: vi.fn().mockRejectedValue({ code: 11000, message: 'duplicate key' }),
      update: vi.fn().mockResolvedValue({ id: 'existing-after-race' }),
    })

    const response = await POST(createRequest(createWebhook()))

    expect(response.status).toBe(200)
    expect(await json(response)).toMatchObject({ message: 'Booking updated', id: 'existing-after-race' })
    expect(payload.create).toHaveBeenCalledOnce()
    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'existing-after-race',
        data: expect.objectContaining({ calcomBookingId: 'booking-new' }),
      }),
    )
  })

  test('keeps existing appointment times when payment events omit schedule fields', async () => {
    const existingBooking = {
      id: 'existing-booking',
      calcomBookingId: 'booking-new',
      startTime: '2026-06-18T14:00:00.000Z',
      endTime: '2026-06-18T14:15:00.000Z',
      attendeeName: 'Taylor Client',
      attendeeEmail: 'taylor@example.com',
      payment: null,
    }
    const payload = createPayloadMock({
      find: findByBookings([existingBooking]),
      update: vi.fn().mockResolvedValue({ id: 'existing-booking' }),
    })

    const response = await POST(
      createRequest(
        createWebhook({
          triggerEvent: 'BOOKING_PAID',
          createdAt: '2026-06-17T12:00:00.000Z',
          payload: {
            startTime: undefined,
            endTime: undefined,
            price: 3500,
            currency: 'usd',
            paymentId: 'pi_123',
          },
        }),
      ),
    )

    expect(response.status).toBe(200)
    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'existing-booking',
        data: expect.objectContaining({
          startTime: '2026-06-18T14:00:00.000Z',
          endTime: '2026-06-18T14:15:00.000Z',
          payment: expect.objectContaining({
            amountPaid: 35,
            status: 'paid',
          }),
        }),
      }),
    )
  })

  test('keeps generic error behavior when duplicate recovery cannot find a row', async () => {
    const payload = createPayloadMock({
      create: vi.fn().mockRejectedValue({ code: 11000, message: 'duplicate key' }),
    })

    const response = await POST(createRequest(createWebhook()))

    expect(response.status).toBe(500)
    expect(await json(response)).toMatchObject({ error: 'Internal server error' })
    expect(payload.update).not.toHaveBeenCalled()
  })
})
