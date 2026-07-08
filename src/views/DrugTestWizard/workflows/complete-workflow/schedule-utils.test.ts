import { describe, expect, test } from 'vitest'

import {
  formatGuidedGender,
  getCalcomBookingActionLinks,
  getGuidedGenderBadgeClass,
  getGuidedPaymentChoice,
  getGuidedPaymentLabel,
} from './schedule-utils'

describe('guided schedule payment helpers', () => {
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

  test('uses light-mode-safe gender badge classes', () => {
    expect(formatGuidedGender('male')).toBe('Male')
    expect(getGuidedGenderBadgeClass('male')).toContain('bg-blue-50 text-blue-900')
    expect(getGuidedGenderBadgeClass('female')).toContain('bg-pink-50 text-pink-900')
  })
})

describe('Cal.com booking action links', () => {
  test('prefers action URLs stored in the raw Cal.com webhook payload', () => {
    expect(
      getCalcomBookingActionLinks({
        calcomBookingId: 'booking-uid',
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
