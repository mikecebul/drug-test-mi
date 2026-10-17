import { z } from 'zod'

export const paymentAmountError = 'Enter a positive amount with no more than two decimal places.'

/** Validate before rounding: rejecting fractions of a cent keeps UI and posting amounts identical. */
export const paymentAmountSchema = z
  .number()
  .finite()
  .positive()
  .refine((amount) => {
    const cents = Math.round(amount * 100)
    return Number.isSafeInteger(cents) && Math.abs(amount * 100 - cents) < 0.00001
  }, paymentAmountError)

export const accountPaymentFormSchema = z.object({
  amount: z.string().refine((value) => paymentAmountSchema.safeParse(Number(value)).success, paymentAmountError),
  sendReceipt: z.boolean(),
})
