import { describe, expect, test } from 'vitest'

import { getDrugTestPaymentSnapshot } from './paymentSnapshot'

describe('getDrugTestPaymentSnapshot', () => {
  test('marks non-guided tests paid with unknown method', async () => {
    const snapshot = await getDrugTestPaymentSnapshot({
      payload: {} as any,
      testType: '17-panel-instant',
    })

    expect(snapshot).toEqual({
      payment: {
        status: 'paid',
        method: 'unknown',
        amountDue: 35,
        amountPaid: 35,
        balanceDue: 0,
        notes: undefined,
      },
    })
  })
})
