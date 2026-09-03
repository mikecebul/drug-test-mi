import { describe, expect, test } from 'vitest'

import {
  doesGuidedBookingNameMatchClient,
  formatGuidedGender,
  getCalcomBookingActionLinks,
  getCalcomPaymentRecoveryStatus,
  getGuidedClientName,
  getGuidedGenderBadgeClass,
  getGuidedPaymentChoice,
  getGuidedPaymentLabel,
  getGuidedBookingNextStep,
  isPastScheduledBookingTime,
} from './schedule-utils'

describe('guided client identity helpers', () => {
  const client = {
    firstName: 'Jane',
    middleInitial: 'Q',
    lastName: "O'Neil-Smith",
  }

  test('uses the linked client name as the displayed identity', () => {
    expect(getGuidedClientName(client)).toBe("Jane Q O'Neil-Smith")
    expect(getGuidedClientName(null)).toBe('')
  })

  test('matches booking names while ignoring punctuation, accents, and middle names', () => {
    expect(doesGuidedBookingNameMatchClient('Jane Quinn Oneil Smith', client)).toBe(true)
    expect(doesGuidedBookingNameMatchClient("O'Neil-Smith, Jane Q", client)).toBe(true)
    expect(
      doesGuidedBookingNameMatchClient('Maria de la Cruz', {
        firstName: 'María',
        lastName: 'de la Cruz',
      }),
    ).toBe(true)
  })

  test('flags a different first or last name for explicit verification', () => {
    expect(doesGuidedBookingNameMatchClient('Janet Quinn Oneil Smith', client)).toBe(false)
    expect(doesGuidedBookingNameMatchClient('Jane Quinn Jones', client)).toBe(false)
    expect(doesGuidedBookingNameMatchClient('', client)).toBe(false)
  })
})

describe('guided schedule payment helpers', () => {
  test('always starts a selected appointment on the review step', () => {
    expect(
      getGuidedBookingNextStep({
        id: 'booking-1',
        needsRegistration: false,
        needsTestType: false,
      }),
    ).toBe('review')
  })

  test('treats unpaid manual bookings as still owing payment', () => {
    const booking = {
      id: 'booking-1',
      needsRegistration: false,
      needsTestType: false,
      payment: {
        status: 'unpaid',
        method: 'not-paid',
        amountDue: 40,
        amountPaid: 0,
      },
    }

    expect(getGuidedPaymentChoice(booking.payment)).toBe('still-owes')
    expect(getGuidedPaymentLabel(booking)).toBe('Still owes')
  })

  test('treats full amount collected as paid even when stale status says unpaid', () => {
    const booking = {
      id: 'booking-1',
      needsRegistration: false,
      needsTestType: false,
      payment: {
        status: 'unpaid',
        method: 'not-paid',
        amountDue: 40,
        amountPaid: 40,
      },
    }

    expect(getGuidedPaymentChoice(booking.payment)).toBe('paid')
    expect(getGuidedPaymentLabel(booking)).toBe('Paid')
  })

  test('labels paid Cal.com bookings as pre-paid when the payment method records that source', () => {
    const booking = {
      id: 'booking-1',
      needsRegistration: false,
      needsTestType: false,
      payment: {
        status: 'paid',
        method: 'pre-paid',
        amountDue: 35,
        amountPaid: 35,
      },
    }

    expect(getGuidedPaymentChoice(booking.payment)).toBe('pre-paid')
    expect(getGuidedPaymentLabel(booking)).toBe('Pre-paid')
  })

  test('keeps bookings without payment data labeled unpaid', () => {
    expect(
      getGuidedPaymentLabel({
        id: 'booking-1',
        needsRegistration: false,
        needsTestType: false,
        payment: null,
      }),
    ).toBe('Unpaid')
  })

  test('identifies an abandoned Cal.com card checkout as a pending payment hold', () => {
    const booking = {
      id: 'booking-pending-payment',
      needsRegistration: false,
      needsTestType: false,
      calcomBookingId: 'cal-pending',
      calcomPaymentId: 'pi_pending',
      createdViaWebhook: true,
      payment: {
        status: 'unpaid',
        method: 'card',
        amountDue: 35,
        amountPaid: 0,
      },
      webhookData: { triggerEvent: 'BOOKING_PAYMENT_INITIATED' },
    }

    expect(getCalcomPaymentRecoveryStatus(booking)).toBe('pending')
    expect(getGuidedPaymentLabel(booking)).toBe('Payment pending')
  })

  test('routes partial Cal.com payments to manual review', () => {
    const booking = {
      id: 'booking-partial-payment',
      needsRegistration: false,
      needsTestType: false,
      calcomBookingId: 'cal-partial',
      createdViaWebhook: true,
      payment: {
        status: 'partial',
        method: 'card',
        amountDue: 35,
        amountPaid: 10,
      },
    }

    expect(getCalcomPaymentRecoveryStatus(booking)).toBe('partial')
    expect(getGuidedPaymentLabel(booking)).toBe('Payment review')
  })

  test('does not mistake manual unpaid, free, or fully paid bookings for payment holds', () => {
    expect(
      getCalcomPaymentRecoveryStatus({
        calcomBookingId: 'manual-unpaid',
        createdViaWebhook: false,
        payment: { status: 'unpaid', method: 'not-paid', amountDue: 35, amountPaid: 0 },
      }),
    ).toBeNull()
    expect(
      getCalcomPaymentRecoveryStatus({
        calcomBookingId: 'free-booking',
        createdViaWebhook: true,
        payment: { status: 'unpaid', method: 'card', amountDue: 0, amountPaid: 0 },
      }),
    ).toBeNull()
    expect(
      getCalcomPaymentRecoveryStatus({
        calcomBookingId: 'paid-booking',
        createdViaWebhook: true,
        payment: { status: 'paid', method: 'pre-paid', amountDue: 35, amountPaid: 35 },
      }),
    ).toBeNull()
  })

  test('uses light-mode-safe gender badge classes', () => {
    expect(formatGuidedGender('male')).toBe('Male')
    expect(formatGuidedGender('other')).toBe('Prefer not to say')
    expect(formatGuidedGender(undefined)).toBe('Unknown')
    expect(getGuidedGenderBadgeClass('male')).toContain('bg-blue-50 text-blue-900')
    expect(getGuidedGenderBadgeClass('female')).toContain('bg-pink-50 text-pink-900')
  })
})

describe('Cal.com booking action links', () => {
  test('uses UID routes when the Cal.com booking id is known', () => {
    expect(
      getCalcomBookingActionLinks({
        calcomBookingId: 'booking-uid',
        webhookData: {
          payload: {
            cancelUrl: 'https://cal.com/booking/stale-booking?cancel=true',
            rescheduleUrl: 'https://cal.com/midrugtest/instant-17-panel?rescheduleUid=stale-booking',
          },
        },
      }),
    ).toEqual({
      cancelHref: 'https://cal.com/booking/booking-uid?cancel=true',
      rescheduleHref: 'https://cal.com/reschedule/booking-uid',
    })
  })

  test('falls back to action URLs stored in the raw Cal.com webhook payload without a booking id', () => {
    expect(
      getCalcomBookingActionLinks({
        webhookData: {
          payload: {
            cancelUrl: 'https://cal.com/booking/booking-uid?cancel=true',
            rescheduleUrl: 'https://cal.com/reschedule/booking-uid',
          },
        },
      }),
    ).toEqual({
      cancelHref: 'https://cal.com/booking/booking-uid?cancel=true',
      rescheduleHref: 'https://cal.com/reschedule/booking-uid',
    })
  })

  test('falls back to Cal.com UID routes when webhook action URLs are unavailable', () => {
    expect(getCalcomBookingActionLinks({ calcomBookingId: 'booking uid' })).toEqual({
      cancelHref: 'https://cal.com/booking/booking%20uid?cancel=true',
      rescheduleHref: 'https://cal.com/reschedule/booking%20uid',
    })
  })
})

describe('scheduled booking time checks', () => {
  const now = new Date('2026-07-10T14:00:00.000Z').getTime()

  test('treats a booking at or before the current time as past', () => {
    expect(isPastScheduledBookingTime('2026-07-10T13:59:59.000Z', now)).toBe(true)
    expect(isPastScheduledBookingTime('2026-07-10T14:00:00.000Z', now)).toBe(true)
  })

  test('keeps future and invalid booking times eligible for the Cal.com action', () => {
    expect(isPastScheduledBookingTime('2026-07-10T14:00:01.000Z', now)).toBe(false)
    expect(isPastScheduledBookingTime('not-a-date', now)).toBe(false)
    expect(isPastScheduledBookingTime(null, now)).toBe(false)
  })
})
