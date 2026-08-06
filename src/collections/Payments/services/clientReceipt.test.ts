import { describe, expect, test } from 'vitest'

import { classifyPaymentReceipt, resolveClientReceiptEmail } from './clientReceipt'

describe('client payment receipts', () => {
  test('classifies paid, partial, and credit-creating receipts', () => {
    expect(classifyPaymentReceipt({ creditAdded: 0, remainingBalance: 0 })).toBe('paid-in-full')
    expect(classifyPaymentReceipt({ creditAdded: 0, remainingBalance: 15 })).toBe('partial')
    expect(classifyPaymentReceipt({ creditAdded: 10, remainingBalance: 0 })).toBe('credit-added')
  })

  test('uses a real client email when client emails are enabled', () => {
    expect(resolveClientReceiptEmail({ email: ' client@example.com ' })).toBe('client@example.com')
  })

  test('rejects a filler email when client emails are disabled', () => {
    expect(
      resolveClientReceiptEmail({
        disableClientEmails: true,
        email: 'no-email.client@example.com',
      }),
    ).toBeNull()
  })
})
