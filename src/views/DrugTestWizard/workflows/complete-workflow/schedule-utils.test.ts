import { describe, expect, test } from 'vitest'

import { getGuidedPaymentChoice, getGuidedPaymentLabel } from './schedule-utils'

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
})
