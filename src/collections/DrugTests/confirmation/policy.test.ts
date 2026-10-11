import { describe, expect, test } from 'vitest'
import {
  confirmationPrice,
  confirmationHoldUntil,
  confirmationHoldExpired,
  confirmationRemaining,
  confirmationPaymentRequired,
} from './policy'
describe('confirmation policy', () => {
  test('prices unique requested panels using the existing per-substance fee', () => {
    expect(confirmationPrice('11-panel-lab')).toBe(45)
    expect(confirmationPrice('17-panel-instant')).toBe(30)
  })
  test('holds for 30 days from the screening result, independent of collection date', () => {
    const until = confirmationHoldUntil('2026-10-07T14:00:00Z')
    expect(until).toBe('2026-11-06T14:00:00.000Z')
    expect(confirmationHoldExpired({ confirmationHoldUntil: until }, Date.parse('2026-11-06T14:00:00Z'))).toBe(true)
  })
  test('a funded fee can proceed while unrelated base debt remains', () => {
    const test = {
      payment: { amountDue: 80, amountPaid: 45, balanceDue: 35, confirmationFeeDue: 45, confirmationFeePaid: 45 },
    }
    expect(confirmationRemaining(test)).toBe(0)
    expect(confirmationPaymentRequired(test)).toBe(false)
  })
  test('partial fees block but referral invoices do not require client prepayment', () => {
    expect(confirmationPaymentRequired({ payment: { confirmationFeeDue: 45, confirmationFeePaid: 20 } })).toBe(true)
    expect(
      confirmationPaymentRequired({
        billingResponsibility: { payer: 'referral' },
        payment: { confirmationFeeDue: 45, confirmationFeePaid: 0 },
      }),
    ).toBe(false)
  })
})
