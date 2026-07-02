import { describe, expect, test } from 'vitest'
import type { getPayload } from 'payload'

import { getDrugTestPaymentSnapshot } from './paymentSnapshot'

type Payload = Awaited<ReturnType<typeof getPayload>>

describe('getDrugTestPaymentSnapshot', () => {
  test('marks non-guided tests paid with unknown method', async () => {
    const snapshot = await getDrugTestPaymentSnapshot({
      payload: {} as Payload,
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

  test('uses configured prices for active lab test types without bookings', async () => {
    const snapshot = await getDrugTestPaymentSnapshot({
      payload: {} as Payload,
      testType: '8-panel-lab',
    })

    expect(snapshot.payment).toMatchObject({
      status: 'paid',
      method: 'unknown',
      amountDue: 40,
      amountPaid: 40,
      balanceDue: 0,
    })
  })
})
