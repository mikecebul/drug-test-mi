import { describe, expect, test, vi } from 'vitest'
import type { Payload } from 'payload'

import type { Booking } from '@/payload-types'
import {
  findCalcomBookingForStripeSession,
  recordCalcomStripeCheckoutPayment,
  syncBookingPaymentClient,
  syncCalcomPrepaidBookingPayment,
} from './calcomBookingPayment'

function createBooking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: 'booking-1',
    title: 'Drug test appointment',
    type: 'drug-test',
    startTime: '2026-06-17T14:00:00.000Z',
    endTime: '2026-06-17T14:15:00.000Z',
    status: 'confirmed',
    organizer: {
      name: 'MI Drug Test',
      email: 'team@midrugtest.com',
    },
    attendeeName: 'Taylor Client',
    attendeeEmail: 'taylor@example.com',
    calcomBookingId: 'cal-booking-1',
    calcomPaymentId: 'pi_calcom',
    payment: {
      amountDue: 35,
      amountPaid: 35,
      method: 'pre-paid',
      status: 'paid',
      collectedAt: '2026-06-17T12:00:00.000Z',
    },
    createdViaWebhook: true,
    createdAt: '2026-06-17T12:00:00.000Z',
    updatedAt: '2026-06-17T12:00:00.000Z',
    ...overrides,
  } as Booking
}

function createMockPayload(options: { payments?: unknown[]; bookings?: unknown[] } = {}) {
  return {
    find: vi.fn().mockImplementation(({ collection, where }) => {
      if (collection === 'payments') {
        return Promise.resolve({ docs: options.payments || [] })
      }

      if (collection === 'bookings') {
        const uid = where?.calcomBookingId?.equals
        const numericId = where?.calcomBookingNumericId?.equals
        const paymentId = where?.calcomPaymentId?.equals
        const booking = (options.bookings || []).find((candidate) => {
          const record = candidate as Record<string, unknown>
          return (
            (uid && record.calcomBookingId === uid) ||
            (numericId && record.calcomBookingNumericId === numericId) ||
            (paymentId && record.calcomPaymentId === paymentId)
          )
        })

        return Promise.resolve({ docs: booking ? [booking] : [] })
      }

      return Promise.resolve({ docs: [] })
    }),
    update: vi.fn().mockImplementation(async ({ collection, data, id }) => ({
      id,
      collection,
      ...data,
    })),
    create: vi.fn().mockImplementation(async ({ collection, data }) => ({
      id: `${collection}-1`,
      collection,
      ...data,
    })),
  }
}

describe('Cal.com booking payment ledger sync', () => {
  test('creates a posted Stripe payment record for a prepaid Cal.com booking without a linked client', async () => {
    const payload = createMockPayload()

    await syncCalcomPrepaidBookingPayment({
      payload: payload as unknown as Payload,
      booking: createBooking({ relatedClient: null }),
      stripeCheckoutSessionId: 'cs_calcom',
    })

    expect(payload.create).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'payments',
        data: expect.objectContaining({
          amount: 35,
          method: 'stripe',
          source: 'calcom',
          status: 'posted',
          relatedBooking: 'booking-1',
          reservedForBookingAmount: 35,
          stripeCheckoutSessionId: 'cs_calcom',
          stripePaymentIntentId: 'pi_calcom',
        }),
      }),
    )
    expect(payload.create.mock.calls[0][0].data.relatedClient).toBeUndefined()
  })

  test('updates an existing Cal.com payment record instead of creating a duplicate', async () => {
    const payload = createMockPayload({
      payments: [
        {
          id: 'payment-1',
          amount: 35,
          method: 'stripe',
          source: 'calcom',
          status: 'posted',
          relatedBooking: 'booking-1',
        },
      ],
    })

    await syncCalcomPrepaidBookingPayment({
      payload: payload as unknown as Payload,
      booking: createBooking({ relatedClient: 'client-1' }),
      stripeCheckoutSessionId: 'cs_calcom',
    })

    expect(payload.create).not.toHaveBeenCalled()
    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'payments',
        id: 'payment-1',
        data: expect.objectContaining({
          relatedClient: 'client-1',
          stripeCheckoutSessionId: 'cs_calcom',
          stripePaymentIntentId: 'pi_calcom',
        }),
      }),
    )
  })

  test('preserves the gross ledger amount after a partial refund', async () => {
    const partiallyRefundedPayment = {
      id: 'payment-1',
      amount: 35,
      refundedAmount: 10,
      method: 'stripe',
      source: 'calcom',
      status: 'posted',
      relatedBooking: 'booking-1',
    }
    const payload = createMockPayload({ payments: [partiallyRefundedPayment] })

    const result = await syncCalcomPrepaidBookingPayment({
      payload: payload as unknown as Payload,
      booking: createBooking({
        payment: {
          amountDue: 25,
          amountPaid: 25,
          method: 'pre-paid',
          status: 'paid',
        },
      }),
    })

    expect(result).toBe(partiallyRefundedPayment)
    expect(payload.update).not.toHaveBeenCalled()
    expect(payload.create).not.toHaveBeenCalled()
  })

  test('attaches existing booking payment records when a client is linked later', async () => {
    const payload = createMockPayload({
      payments: [
        {
          id: 'payment-1',
          amount: 35,
          method: 'stripe',
          source: 'calcom',
          status: 'posted',
          relatedBooking: 'booking-1',
          relatedClient: null,
        },
      ],
    })

    await syncBookingPaymentClient({
      payload: payload as unknown as Payload,
      bookingId: 'booking-1',
      clientId: 'client-1',
    })

    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'payments',
        id: 'payment-1',
        data: {
          relatedClient: 'client-1',
        },
      }),
    )
  })

  test('records Cal.com Stripe checkout sessions against matching bookings', async () => {
    const booking = createBooking({
      payment: undefined,
      calcomPaymentId: null,
    })
    const payload = createMockPayload({ bookings: [booking] })
    const matchedBooking = await findCalcomBookingForStripeSession(payload as unknown as Payload, {
      metadata: {
        bookingUid: 'cal-booking-1',
      },
      stripeCheckoutSessionId: 'cs_calcom',
      stripePaymentIntentId: 'pi_calcom',
    })

    expect(matchedBooking?.id).toBe('booking-1')

    await recordCalcomStripeCheckoutPayment({
      payload: payload as unknown as Payload,
      booking,
      amount: 35,
      stripeCheckoutSessionId: 'cs_calcom',
      stripePaymentIntentId: 'pi_calcom',
      collectedAt: '2026-06-17T12:00:00.000Z',
    })

    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'bookings',
        id: 'booking-1',
        data: expect.objectContaining({
          calcomPaymentId: 'pi_calcom',
          payment: expect.objectContaining({
            amountPaid: 35,
            method: 'pre-paid',
            status: 'paid',
          }),
        }),
      }),
    )
    expect(payload.create).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'payments',
        data: expect.objectContaining({
          relatedBooking: 'booking-1',
          amount: 35,
          stripeCheckoutSessionId: 'cs_calcom',
          stripePaymentIntentId: 'pi_calcom',
        }),
      }),
    )
  })
})
