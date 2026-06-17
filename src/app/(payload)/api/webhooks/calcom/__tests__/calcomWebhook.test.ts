import crypto from 'crypto'
import { describe, expect, test } from 'vitest'

import {
  buildCalcomBookingData,
  getCalcomBookingNumericId,
  getCalcomBookingUid,
  getCalcomRescheduleUid,
  normalizeCalcomMoney,
  verifyCalcomWebhookSignature,
  type CalcomWebhookPayload,
} from '../calcomWebhook'

function createWebhook(overrides: Partial<CalcomWebhookPayload> = {}): CalcomWebhookPayload {
  const payload: CalcomWebhookPayload['payload'] = {
    type: 'drug-test',
    title: 'Drug Test Appointment',
    startTime: '2026-06-17T14:00:00.000Z',
    endTime: '2026-06-17T14:15:00.000Z',
    id: 12345,
    uid: 'booking-new',
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
    ...overrides.payload,
  }

  return {
    triggerEvent: 'BOOKING_CREATED',
    createdAt: '2026-06-17T12:00:00.000Z',
    ...overrides,
    payload,
  }
}

describe('Cal.com webhook helpers', () => {
  test('verifies Cal.com sha256 webhook signatures', () => {
    const rawBody = JSON.stringify(createWebhook())
    const secret = 'webhook-secret'
    const signature = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')

    expect(verifyCalcomWebhookSignature(rawBody, `sha256=${signature}`, secret)).toBe(true)
    expect(verifyCalcomWebhookSignature(rawBody, signature, secret)).toBe(true)
    expect(verifyCalcomWebhookSignature(rawBody, `sha256=${'0'.repeat(64)}`, secret)).toBe(false)
    expect(verifyCalcomWebhookSignature(rawBody, null, secret)).toBe(false)
  })

  test('maps Cal.com reschedules to the original and new booking UIDs', () => {
    const webhook = createWebhook({
      triggerEvent: 'BOOKING_RESCHEDULED',
      payload: {
        uid: 'booking-new',
        rescheduleUid: 'booking-original',
        startTime: '2026-06-17T16:00:00.000Z',
        endTime: '2026-06-17T16:15:00.000Z',
      },
    })

    expect(getCalcomBookingUid(webhook.payload)).toBe('booking-new')
    expect(getCalcomBookingNumericId(webhook.payload)).toBe(12345)
    expect(getCalcomRescheduleUid(webhook.payload)).toBe('booking-original')
    expect(buildCalcomBookingData(webhook).calcomBookingId).toBe('booking-new')
    expect(buildCalcomBookingData(webhook).calcomBookingNumericId).toBe(12345)
    expect(buildCalcomBookingData(webhook).calcomRescheduledFromId).toBe('booking-original')
  })

  test('normalizes paid Cal.com bookings into prepaid workflow payment fields', () => {
    const webhook = createWebhook({
      triggerEvent: 'BOOKING_PAID',
      payload: {
        price: 3500,
        currency: 'usd',
        paymentId: 'pi_123',
      },
    })

    const bookingData = buildCalcomBookingData(webhook)

    expect(normalizeCalcomMoney(3500)).toBe(35)
    expect(bookingData.calcomPaymentId).toBe('pi_123')
    expect(bookingData.payment).toMatchObject({
      amountDue: 35,
      amountPaid: 35,
      method: 'pre-paid',
      status: 'paid',
    })
  })

  test('preserves existing payment when reschedule payload has no new payment data', () => {
    const webhook = createWebhook({
      triggerEvent: 'BOOKING_RESCHEDULED',
      payload: {
        uid: 'booking-new',
        rescheduleUid: 'booking-original',
      },
    })

    const bookingData = buildCalcomBookingData(webhook, {
      amountDue: 40,
      amountPaid: 40,
      method: 'pre-paid',
      status: 'paid',
      collectedAt: '2026-06-16T12:00:00.000Z',
    })

    expect(bookingData.payment).toBeUndefined()
  })
})
