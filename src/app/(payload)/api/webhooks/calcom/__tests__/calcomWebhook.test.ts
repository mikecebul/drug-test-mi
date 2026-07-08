import crypto from 'crypto'
import { describe, expect, test, vi } from 'vitest'

import {
  allowsUnsignedCalcomWebhooks,
  buildCalcomBookingData,
  findCalcomScheduledTestTypeMatch,
  getCalcomBookingNumericId,
  getCalcomBookingUid,
  getCalcomRescheduleUid,
  getCalcomScheduledTestAnswer,
  getCalcomScheduledTestAnswerCandidates,
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

  test('allows unsigned Cal.com webhooks in test mode only', () => {
    try {
      vi.stubEnv('NODE_ENV', 'test')
      expect(allowsUnsignedCalcomWebhooks()).toBe(true)
      expect(verifyCalcomWebhookSignature('{}', null, undefined)).toBe(true)

      vi.stubEnv('NODE_ENV', 'production')
      expect(allowsUnsignedCalcomWebhooks()).toBe(false)
      expect(verifyCalcomWebhookSignature('{}', null, undefined)).toBe(false)
    } finally {
      vi.unstubAllEnvs()
    }
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

  test('preserves an existing booking schedule when payment payload has no appointment times', () => {
    const webhook = createWebhook({
      triggerEvent: 'BOOKING_PAID',
      payload: {
        startTime: undefined,
        endTime: undefined,
        price: 3500,
        currency: 'usd',
        paymentId: 'pi_123',
      },
    })

    const bookingData = buildCalcomBookingData(webhook, null, {
      startTime: '2026-06-18T14:00:00.000Z',
      endTime: '2026-06-18T14:15:00.000Z',
      attendeeName: 'Taylor Client',
      attendeeEmail: 'taylor@example.com',
    })

    expect(bookingData.startTime).toBe('2026-06-18T14:00:00.000Z')
    expect(bookingData.endTime).toBe('2026-06-18T14:15:00.000Z')
    expect(bookingData.attendeeName).toBe('Taylor Client')
    expect(bookingData.attendeeEmail).toBe('taylor@example.com')
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

  test('extracts the scheduled test answer from the Cal.com test question', () => {
    expect(
      getCalcomScheduledTestAnswer(
        createWebhook({
          payload: {
            responses: {
              test: {
                label: 'Test',
                value: '11 Panel Lab (no EtG)',
              },
            },
          },
        }).payload,
      ),
    ).toBe('11 Panel Lab (no EtG)')

    expect(
      getCalcomScheduledTestAnswer(
        createWebhook({
          payload: {
            customInputs: {
              test: '17 SOS Lab',
            },
          },
        }).payload,
      ),
    ).toBe('17 SOS Lab')
  })

  test('includes Cal.com event metadata as scheduled test candidates for self-booking links', () => {
    const candidates = getCalcomScheduledTestAnswerCandidates(
      createWebhook({
        payload: {
          type: 'Instant 17 Panel',
          title: '17 Panel Instant Screen',
          bookerUrl: 'https://cal.com/midrugtest/instant-17-panel',
        },
      }).payload,
    )

    expect(candidates).toEqual(
      expect.arrayContaining([
        'Instant 17 Panel',
        '17 Panel Instant Screen',
        'https://cal.com/midrugtest/instant-17-panel',
      ]),
    )
  })

  test('matches Cal.com scheduled test answers with supported booking label aliases', () => {
    const testTypes = [
      {
        id: 'test-type-11-panel-lab',
        label: '11-Panel Lab',
        bookingLabel: '11 Panel Lab',
        value: '11-panel-lab',
      },
      {
        id: 'test-type-11-panel-no-etg',
        label: '11-Panel Lab (no EtG)',
        bookingLabel: '11 Panel Lab (no EtG)',
        value: '11-panel-lab-no-etg',
      },
      {
        id: 'test-type-17-sos-lab',
        label: '17-Panel SOS Lab',
        bookingLabel: '17 SOS Lab',
        value: '17-panel-sos-lab',
      },
      {
        id: 'test-type-8-panel-lab',
        label: '8-Panel Lab',
        bookingLabel: '8 Panel Lab',
        value: '8-panel-lab',
      },
      {
        id: 'test-type-etg-lab',
        label: 'EtG Lab',
        bookingLabel: 'EtG Lab',
        value: 'etg-lab',
      },
      {
        id: 'test-type-17-panel-instant',
        label: '17-Panel Instant',
        bookingLabel: '17 Panel Instant',
        value: '17-panel-instant',
      },
    ]

    expect(findCalcomScheduledTestTypeMatch(testTypes, '17 Panel Lab')?.id).toBe('test-type-17-sos-lab')
    expect(findCalcomScheduledTestTypeMatch(testTypes, 'Drug Test - 11 Panel no EtG')?.id).toBe(
      'test-type-11-panel-no-etg',
    )
    expect(findCalcomScheduledTestTypeMatch(testTypes, 'Drug Test - 11 Panel Lab no EtG')?.id).toBe(
      'test-type-11-panel-no-etg',
    )
    expect(findCalcomScheduledTestTypeMatch(testTypes, '11 Panel no EtG')?.id).toBe('test-type-11-panel-no-etg')
    expect(findCalcomScheduledTestTypeMatch(testTypes, 'EtG')?.id).toBe('test-type-etg-lab')
    expect(findCalcomScheduledTestTypeMatch(testTypes, 'https://cal.com/midrugtest/harbor-industries-drug-test-booking')?.id).toBe(
      'test-type-8-panel-lab',
    )
    expect(findCalcomScheduledTestTypeMatch(testTypes, 'https://cal.com/midrugtest/11-panel-lab-screen')?.id).toBe(
      'test-type-11-panel-lab',
    )
    expect(findCalcomScheduledTestTypeMatch(testTypes, 'https://cal.com/midrugtest/sos-17-panel-lab-screen')?.id).toBe(
      'test-type-17-sos-lab',
    )
    expect(findCalcomScheduledTestTypeMatch(testTypes, 'https://cal.com/midrugtest/etg-lab-screen')?.id).toBe(
      'test-type-etg-lab',
    )
    expect(findCalcomScheduledTestTypeMatch(testTypes, 'https://cal.com/midrugtest/instant-17-panel')?.id).toBe(
      'test-type-17-panel-instant',
    )
  })
})
