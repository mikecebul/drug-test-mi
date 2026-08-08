import { describe, expect, test } from 'vitest'

import type { Booking } from '@/payload-types'

import { getBookingPaymentAfterRefund } from './refund-state'

function booking(amountDue: number, amountPaid: number): Booking {
  return {
    id: 'booking-1',
    title: 'Booking',
    type: 'calcom',
    startTime: '2026-08-08T12:00:00.000Z',
    endTime: '2026-08-08T12:30:00.000Z',
    status: 'confirmed',
    organizer: { name: 'MI Drug Test', email: 'admin@example.com', timeZone: 'America/Detroit' },
    attendeeName: 'Test Client',
    attendeeEmail: 'client@example.com',
    payment: {
      amountDue,
      amountPaid,
      method: 'pre-paid',
      status: amountPaid >= amountDue ? 'paid' : 'partial',
      collectedAt: '2026-08-08T12:00:00.000Z',
    },
    updatedAt: '2026-08-08T12:00:00.000Z',
    createdAt: '2026-08-08T12:00:00.000Z',
  }
}

describe('booking refund state', () => {
  test('records a partial refund as a reduced paid price', () => {
    expect(getBookingPaymentAfterRefund(booking(60, 60), 15)).toMatchObject({
      amountDue: 45,
      amountPaid: 45,
      method: 'pre-paid',
      status: 'paid',
    })
  })

  test('records a full refund without leaving a false balance due', () => {
    expect(getBookingPaymentAfterRefund(booking(60, 60), 60)).toMatchObject({
      amountDue: 0,
      amountPaid: 0,
      method: 'not-paid',
      status: 'paid',
      collectedAt: null,
    })
  })

  test('preserves an existing balance while reducing the charged price', () => {
    expect(getBookingPaymentAfterRefund(booking(60, 50), 10)).toMatchObject({
      amountDue: 50,
      amountPaid: 40,
      status: 'partial',
    })
  })
})
