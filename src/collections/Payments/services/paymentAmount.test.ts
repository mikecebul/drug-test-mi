import { expect, test } from 'vitest'
import { accountPaymentFormSchema, paymentAmountSchema } from './paymentAmount'
test.each(['', ' ', '0', '-10', 'NaN', 'Infinity', '0.001', '45.001', '9007199254740992'])(
  'invalid cash input %j is rejected before a payment can be posted',
  (amount) => {
    expect(accountPaymentFormSchema.safeParse({ amount, sendReceipt: false }).success).toBe(false)
    expect(paymentAmountSchema.safeParse(Number(amount)).success).toBe(false)
  },
)
test.each(['0.01', '40', '45.50', '0.29'])('cash input %j and server posting agree on cent precision', (amount) => {
  expect(accountPaymentFormSchema.safeParse({ amount, sendReceipt: true }).success).toBe(true)
  expect(paymentAmountSchema.safeParse(Number(amount)).success).toBe(true)
})
