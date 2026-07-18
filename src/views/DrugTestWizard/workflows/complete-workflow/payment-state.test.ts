import { describe, expect, test } from 'vitest'

import { updatePaidAmount, updateStillOwesAmount } from './payment-state'

const unpaidPayment = {
  amountDue: 35,
  amountPaid: 0,
  choice: 'still-owes' as const,
  method: 'cash' as const,
}

describe('guided payment amount state', () => {
  test("preserves money collected above today's test price", () => {
    expect(updateStillOwesAmount(unpaidPayment, 75)).toEqual({
      ...unpaidPayment,
      amountPaid: 75,
      choice: 'paid',
    })
  })

  test('keeps a partial payment in the still-owes state', () => {
    expect(updateStillOwesAmount(unpaidPayment, 20)).toEqual({
      ...unpaidPayment,
      amountPaid: 20,
    })
  })

  test('changes prepaid to cash when additional money is collected', () => {
    expect(
      updatePaidAmount(
        {
          amountDue: 35,
          amountPaid: 35,
          choice: 'paid',
          method: 'pre-paid',
        },
        75,
      ),
    ).toMatchObject({
      amountPaid: 75,
      method: 'cash',
    })
  })
})
