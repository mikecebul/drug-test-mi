import { describe, expect, test } from 'vitest'

import {
  buildGuidedPaymentAllocationPreview,
  compactPreviousPaymentAllocations,
  getGuidedPaymentQuickAmounts,
  isValidGuidedCreditAmount,
  isValidGuidedPaymentAmount,
  parseGuidedPaymentAmount,
  type GuidedOutstandingBalance,
} from './payment-state'

const previousBalance = (id: string, balanceDue = 35): GuidedOutstandingBalance => ({
  id,
  collectionDate: '2026-05-12T12:00:00.000Z',
  testTypeLabel: '17-Panel Instant',
  balanceDue,
})

describe('guided payment allocation preview', () => {
  test('applies a $50 payment to the old test before today', () => {
    const preview = buildGuidedPaymentAllocationPreview({
      previousBalances: [previousBalance('old-test')],
      currentBalanceDue: 35,
      amountReceived: 50,
    })

    expect(preview).toMatchObject({
      previousBalanceTotal: 35,
      currentBalanceDue: 35,
      totalDue: 70,
      currentAmountApplied: 15,
      currentBalanceRemaining: 20,
      creditAmount: 0,
      remainingClientBalance: 20,
    })
    expect(preview.previousAllocations).toEqual([
      expect.objectContaining({
        id: 'old-test',
        amountApplied: 35,
        balanceRemaining: 0,
      }),
    ])
  })

  test('pays all of the oldest test and part of the second before today', () => {
    const preview = buildGuidedPaymentAllocationPreview({
      previousBalances: [previousBalance('oldest-test'), previousBalance('second-oldest-test')],
      currentBalanceDue: 35,
      amountReceived: 50,
    })

    expect(preview.previousAllocations).toEqual([
      expect.objectContaining({ id: 'oldest-test', amountApplied: 35, balanceRemaining: 0 }),
      expect.objectContaining({ id: 'second-oldest-test', amountApplied: 15, balanceRemaining: 20 }),
    ])
    expect(preview.currentAmountApplied).toBe(0)
    expect(preview.currentBalanceRemaining).toBe(35)
    expect(preview.remainingClientBalance).toBe(55)
  })

  test('turns money above the full balance into client credit', () => {
    const preview = buildGuidedPaymentAllocationPreview({
      previousBalances: [previousBalance('old-test')],
      currentBalanceDue: 35,
      amountReceived: 90,
    })

    expect(preview.previousAllocations[0].amountApplied).toBe(35)
    expect(preview.currentAmountApplied).toBe(35)
    expect(preview.remainingClientBalance).toBe(0)
    expect(preview.creditAmount).toBe(20)
  })

  test('shows client credit as a separate oldest-first payment source', () => {
    const preview = buildGuidedPaymentAllocationPreview({
      previousBalances: [previousBalance('old-test')],
      currentBalanceDue: 40,
      clientCreditAvailable: 50,
      clientCreditApplied: 50,
      amountReceived: 10,
    })

    expect(preview).toMatchObject({
      totalDue: 75,
      clientCreditAvailable: 50,
      clientCreditApplied: 50,
      clientCreditRemaining: 0,
      dueAfterCredit: 25,
      previousBalanceAfterCredit: 0,
      currentCreditApplied: 15,
      currentNewMoneyApplied: 10,
      currentBalanceAfterCredit: 25,
      currentBalanceRemaining: 15,
      remainingClientBalance: 15,
    })
    expect(preview.previousAllocations[0]).toMatchObject({
      creditApplied: 35,
      newMoneyApplied: 0,
      balanceRemaining: 0,
    })
  })

  test('validates applied credit against both available credit and total due', () => {
    expect(isValidGuidedCreditAmount('40', 50, 40)).toBe(true)
    expect(isValidGuidedCreditAmount('41', 50, 40)).toBe(false)
    expect(isValidGuidedCreditAmount('51', 50, 80)).toBe(false)
    expect(isValidGuidedCreditAmount('-1', 50, 80)).toBe(false)
  })

  test('allows an empty transient input and has no upper payment limit', () => {
    expect(isValidGuidedPaymentAmount('')).toBe(true)
    expect(parseGuidedPaymentAmount('')).toBe(0)
    expect(isValidGuidedPaymentAmount('500')).toBe(true)
    expect(parseGuidedPaymentAmount('500')).toBe(500)
    expect(isValidGuidedPaymentAmount('-1')).toBe(false)
  })

  test('provides unique zero, today, and pay-all quick amounts', () => {
    expect(getGuidedPaymentQuickAmounts(35, 70)).toEqual([0, 35, 70])
    expect(getGuidedPaymentQuickAmounts(35, 35)).toEqual([0, 35])
  })

  test('collapses long histories around the first unpaid balance', () => {
    const preview = buildGuidedPaymentAllocationPreview({
      previousBalances: Array.from({ length: 7 }, (_, index) => previousBalance(`test-${index + 1}`)),
      currentBalanceDue: 35,
      amountReceived: 120,
    })

    const compactRows = compactPreviousPaymentAllocations(preview.previousAllocations)

    expect(compactRows).toEqual([
      expect.objectContaining({ kind: 'detail', allocation: expect.objectContaining({ id: 'test-1' }) }),
      expect.objectContaining({ kind: 'summary', count: 2, amountApplied: 70 }),
      expect.objectContaining({ kind: 'detail', allocation: expect.objectContaining({ id: 'test-4' }) }),
      expect.objectContaining({ kind: 'summary', count: 3, amountApplied: 0 }),
    ])
  })
})
