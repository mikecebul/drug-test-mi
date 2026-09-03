import { beforeEach, describe, expect, test, vi } from 'vitest'

const mockCancelCalcomBooking = vi.hoisted(() => vi.fn())
const mockCreateCalcomBooking = vi.hoisted(() => vi.fn())
const mockGetValidatedEventType = vi.hoisted(() => vi.fn())
const mockRetrievePaymentIntent = vi.hoisted(() => vi.fn())

vi.mock('@/utilities/calcom-api', () => ({
  cancelCalcomBooking: mockCancelCalcomBooking,
  createCalcomBooking: mockCreateCalcomBooking,
}))

vi.mock('@/lib/random-testing/calcom', () => ({
  getValidatedRandomTestingCalcomEventType: mockGetValidatedEventType,
}))

vi.mock('stripe', () => ({
  default: class MockStripe {
    paymentIntents = { retrieve: mockRetrievePaymentIntent }
  },
}))

import { recoverPendingPaymentBooking } from './pending-payment-recovery'

const now = new Date('2026-07-10T14:00:00.000Z')

function createPendingBooking(overrides: Record<string, unknown> = {}) {
  return {
    id: 'booking-original',
    title: 'Paid Drug Test',
    type: '15min',
    startTime: '2026-07-10T16:00:00.000Z',
    endTime: '2026-07-10T16:15:00.000Z',
    status: 'confirmed',
    attendeeName: 'Taylor Client',
    attendeeEmail: 'taylor@example.com',
    calcomBookingId: 'cal-original',
    calcomPaymentId: 'cal-payment-123',
    createdViaWebhook: true,
    relatedClient: 'client-1',
    scheduledTestType: '17-panel-instant',
    organizer: {
      name: 'MI Drug Test',
      email: 'team@midrugtest.com',
      timeZone: 'America/Detroit',
    },
    payment: {
      amountDue: 35,
      amountPaid: 0,
      method: 'card',
      status: 'unpaid',
    },
    webhookData: { triggerEvent: 'BOOKING_PAYMENT_INITIATED' },
    sampleCollection: null,
    ...overrides,
  }
}

const client = {
  id: 'client-1',
  firstName: 'Taylor',
  middleInitial: null,
  lastName: 'Client',
  email: 'taylor@example.com',
  phone: '5175550100',
  gender: 'female',
}

const calcomReplacement = {
  id: 456,
  uid: 'cal-replacement',
  title: 'Drug Test - Taylor Client',
  start: '2026-07-10T16:00:00.000Z',
  end: '2026-07-10T16:10:00.000Z',
  eventTypeId: 3684719,
  location: 'MI Drug Test',
  hosts: [
    {
      id: 12,
      name: 'MI Drug Test',
      email: 'team@midrugtest.com',
      timeZone: 'America/Detroit',
    },
  ],
}

function createPayload(booking = createPendingBooking()) {
  const localReplacement = {
    ...booking,
    id: 'booking-replacement',
    calcomBookingId: calcomReplacement.uid,
    createdViaWebhook: false,
  }

  return {
    payload: {
      create: vi.fn().mockResolvedValue(localReplacement),
      find: vi.fn().mockResolvedValue({ docs: [] }),
      findByID: vi.fn(async ({ collection }: { collection: string }) => (collection === 'clients' ? client : booking)),
      update: vi.fn(async ({ id, data }: { data: Record<string, unknown>; id: string }) => ({
        ...(id === localReplacement.id ? localReplacement : booking),
        ...data,
      })),
    },
    localReplacement,
  }
}

describe('pending Cal.com payment recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
    mockGetValidatedEventType.mockResolvedValue({ id: 3684719, lengthInMinutes: 10 })
    mockCreateCalcomBooking.mockResolvedValue(calcomReplacement)
    mockCancelCalcomBooking.mockResolvedValue({ success: true })
  })

  test('accepts a hold by creating an unpaid booking before cancelling the original', async () => {
    const { payload } = createPayload()

    const result = await recoverPendingPaymentBooking({
      action: 'accept',
      bookingId: 'booking-original',
      now,
      payload: payload as never,
    })

    expect(result).toMatchObject({ success: true, bookingId: 'booking-replacement' })
    expect(mockCreateCalcomBooking).toHaveBeenCalledWith(
      expect.objectContaining({
        attendee: expect.objectContaining({
          name: 'Taylor Client',
          email: 'taylor@example.com',
        }),
        eventTypeId: 3684719,
        metadata: expect.objectContaining({
          source: 'pending-payment-recovery',
          paymentStatus: 'unpaid',
          replacedPendingCalcomBookingUid: 'cal-original',
        }),
        start: '2026-07-10T16:00:00.000Z',
      }),
    )
    expect(payload.create).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'bookings',
        data: expect.objectContaining({
          calcomBookingId: 'cal-replacement',
          createdViaWebhook: false,
          relatedClient: 'client-1',
          payment: expect.objectContaining({ amountPaid: 0, method: 'not-paid', status: 'unpaid' }),
        }),
      }),
    )
    expect(mockCancelCalcomBooking).toHaveBeenCalledWith({
      bookingUid: 'cal-original',
      cancellationReason: 'Replaced with an unpaid booking accepted by staff',
    })
    expect(payload.create.mock.invocationCallOrder[0]).toBeLessThan(mockCancelCalcomBooking.mock.invocationCallOrder[0])
    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'booking-original', data: { status: 'cancelled' } }),
    )
  })

  test('cancels a pending hold without creating a replacement', async () => {
    const { payload } = createPayload()

    const result = await recoverPendingPaymentBooking({
      action: 'cancel',
      bookingId: 'booking-original',
      now,
      payload: payload as never,
    })

    expect(result).toEqual({ success: true })
    expect(mockCreateCalcomBooking).not.toHaveBeenCalled()
    expect(mockCancelCalcomBooking).toHaveBeenCalledWith({
      bookingUid: 'cal-original',
      cancellationReason: 'Pending payment cancelled by staff',
    })
    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'booking-original', data: { status: 'cancelled' } }),
    )
  })

  test('rolls back the unpaid replacement when the original cannot be cancelled', async () => {
    const { payload, localReplacement } = createPayload()
    payload.find
      .mockResolvedValueOnce({ docs: [] })
      .mockResolvedValueOnce({ docs: [] })
      .mockResolvedValueOnce({ docs: [localReplacement] })
    mockCancelCalcomBooking
      .mockResolvedValueOnce({ success: false, error: 'Cal.com is unavailable.' })
      .mockResolvedValueOnce({ success: true })

    const result = await recoverPendingPaymentBooking({
      action: 'reschedule',
      bookingId: 'booking-original',
      now,
      payload: payload as never,
    })

    expect(result).toMatchObject({
      success: false,
      error: expect.stringContaining('replacement was rolled back'),
    })
    expect(mockCancelCalcomBooking).toHaveBeenNthCalledWith(2, {
      bookingUid: 'cal-replacement',
      cancellationReason: 'Rolled back because the original pending-payment booking could not be cancelled',
    })
    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'booking-replacement', data: { status: 'cancelled' } }),
    )
    expect(payload.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ id: 'booking-original', data: { status: 'cancelled' } }),
    )
  })

  test('reuses an active recovery replacement when a previous response was interrupted', async () => {
    const { payload, localReplacement } = createPayload()
    payload.find.mockResolvedValueOnce({
      docs: [{ ...localReplacement, status: 'confirmed', calcomRescheduledFromId: 'cal-original' }],
    })

    const result = await recoverPendingPaymentBooking({
      action: 'reschedule',
      bookingId: 'booking-original',
      now,
      payload: payload as never,
    })

    expect(result).toMatchObject({
      success: true,
      bookingId: 'booking-replacement',
      rescheduleHref: 'https://cal.com/reschedule/cal-replacement',
    })
    expect(mockCreateCalcomBooking).not.toHaveBeenCalled()
    expect(payload.create).not.toHaveBeenCalled()
    expect(mockCancelCalcomBooking).toHaveBeenCalledWith({
      bookingUid: 'cal-original',
      cancellationReason: 'Replaced with an unpaid booking for staff rescheduling',
    })
  })

  test('refuses automated recovery for a partial payment', async () => {
    const { payload } = createPayload(
      createPendingBooking({
        payment: { amountDue: 35, amountPaid: 10, method: 'card', status: 'partial' },
      }),
    )

    const result = await recoverPendingPaymentBooking({
      action: 'cancel',
      bookingId: 'booking-original',
      now,
      payload: payload as never,
    })

    expect(result).toMatchObject({ success: false, error: expect.stringContaining('partial payment') })
    expect(mockCancelCalcomBooking).not.toHaveBeenCalled()
    expect(mockCreateCalcomBooking).not.toHaveBeenCalled()
  })

  test('rechecks Stripe and aborts when payment completed while the dialog was open', async () => {
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_example')
    mockRetrievePaymentIntent.mockResolvedValue({ amount_received: 3500, status: 'succeeded' })
    const { payload } = createPayload(createPendingBooking({ calcomPaymentId: 'pi_completed' }))

    const result = await recoverPendingPaymentBooking({
      action: 'accept',
      bookingId: 'booking-original',
      now,
      payload: payload as never,
    })

    expect(mockRetrievePaymentIntent).toHaveBeenCalledWith('pi_completed')
    expect(result).toMatchObject({
      success: false,
      refreshRequired: true,
      error: expect.stringContaining('payment changed'),
    })
    expect(mockCreateCalcomBooking).not.toHaveBeenCalled()
    expect(mockCancelCalcomBooking).not.toHaveBeenCalled()
  })

  test('does not accept a payment hold whose scheduled time has passed', async () => {
    const { payload } = createPayload(createPendingBooking({ startTime: '2026-07-10T13:59:00.000Z' }))

    const result = await recoverPendingPaymentBooking({
      action: 'accept',
      bookingId: 'booking-original',
      now,
      payload: payload as never,
    })

    expect(result).toMatchObject({ success: false, error: expect.stringContaining('past') })
    expect(mockCreateCalcomBooking).not.toHaveBeenCalled()
  })
})
