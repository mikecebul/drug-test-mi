import { describe, expect, test } from 'vitest'

import { getTestStage, shouldStayInTracker } from './stage'

describe('drug test tracker stages', () => {
  test('keeps an incomplete unpaid test in its workflow stage', () => {
    const testState = {
      isComplete: false,
      payment: {
        status: 'unpaid',
        balanceDue: 35,
      },
    }

    expect(getTestStage(testState).stage).toBe('Awaiting Results')
    expect(shouldStayInTracker(testState)).toBe(true)
  })

  test('moves a completed unpaid test to payment due', () => {
    expect(
      getTestStage({
        isComplete: true,
        initialScreenResult: 'negative',
        payment: {
          status: 'unpaid',
          balanceDue: 35,
        },
      }).stage,
    ).toBe('Payment Due')
  })

  test('removes a completed paid test from the tracker', () => {
    expect(
      shouldStayInTracker({
        isComplete: true,
        initialScreenResult: 'negative',
        payment: {
          status: 'paid',
          balanceDue: 0,
        },
      }),
    ).toBe(false)
  })
})

test('deferred decisions leave active tracking after the hold but unpaid base debt remains visible', () => {
  const test = {
    isComplete: false,
    confirmationDecision: 'pending-decision',
    confirmationHoldUntil: '2025-01-01T00:00:00Z',
    payment: { balanceDue: 0 },
  }
  expect(shouldStayInTracker(test)).toBe(false)
  expect(shouldStayInTracker({ ...test, payment: { balanceDue: 35 } })).toBe(true)
})
test('paid and referral confirmations do not wait for unrelated client balance', () => {
  const test = {
    isComplete: false,
    initialScreenResult: 'unexpected-positive',
    confirmationDecision: 'request-confirmation',
    payment: { amountDue: 80, amountPaid: 45, balanceDue: 35, confirmationFeeDue: 45, confirmationFeePaid: 45 },
  }
  expect(getTestStage(test).stage).toBe('Pending Confirmation')
  expect(
    getTestStage({
      ...test,
      billingResponsibility: { payer: 'referral' },
      payment: { ...test.payment, confirmationFeePaid: 0, amountPaid: 0 },
    }).stage,
  ).toBe('Pending Confirmation')
})
