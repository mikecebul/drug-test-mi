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
