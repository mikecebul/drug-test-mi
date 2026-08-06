import { describe, expect, test } from 'vitest'

import { buildPaymentReceiptEmail, type PaymentReceiptEmailProps } from '.'

const baseReceipt = {
  appliedToPreviousBalances: 10,
  appliedToToday: 25,
  cashReceived: 35,
  clientCreditApplied: 0,
  clientCreditBalance: 0,
  clientName: 'Jordan Smith',
  creditAdded: 0,
  paymentDate: 'August 6, 2026 at 12:30 PM ET',
  paymentMethod: 'Cash',
  receiptType: 'paid-in-full',
  remainingBalance: 0,
  testName: '17-Panel Instant',
} satisfies PaymentReceiptEmailProps

describe('PaymentReceiptEmail', () => {
  test('renders a paid-in-full receipt', async () => {
    const email = await buildPaymentReceiptEmail(baseReceipt)

    expect(email.subject).toBe('Payment receipt - MI Drug Test')
    expect(email.html).toContain('Payment received in full')
    expect(email.html).toContain('17-Panel Instant')
    expect(email.html).toContain('$35.00')
  })

  test('renders a partial-payment receipt with the remaining balance', async () => {
    const email = await buildPaymentReceiptEmail({
      ...baseReceipt,
      appliedToToday: 10,
      cashReceived: 20,
      receiptType: 'partial',
      remainingBalance: 15,
    })

    expect(email.subject).toBe('Partial payment receipt - MI Drug Test')
    expect(email.html).toContain('Partial payment received')
    expect(email.html).toContain('$15.00 remains due')
  })

  test('renders newly created client credit', async () => {
    const email = await buildPaymentReceiptEmail({
      ...baseReceipt,
      cashReceived: 50,
      clientCreditBalance: 15,
      creditAdded: 15,
      receiptType: 'credit-added',
    })

    expect(email.html).toContain('Payment received and credit added')
    expect(email.html).toContain('$15.00 was added to your client credit')
    expect(email.html).toContain('New client credit')
  })
})
