import { normalizeMoney } from '@/collections/Payments/services/applyPayment'
import type { Booking } from '@/payload-types'

export function getBookingPaymentAfterRefund(booking: Booking, refundAmount: number) {
  const existingPayment = booking.payment || {}
  const amountDue = normalizeMoney(existingPayment.amountDue)
  const amountPaid = normalizeMoney(existingPayment.amountPaid)
  const nextAmountDue = Math.max(0, normalizeMoney(amountDue - refundAmount))
  const nextAmountPaid = Math.max(0, normalizeMoney(amountPaid - refundAmount))
  const nextBalanceDue = Math.max(0, normalizeMoney(nextAmountDue - nextAmountPaid))

  return {
    ...existingPayment,
    amountDue: nextAmountDue,
    amountPaid: nextAmountPaid,
    method: nextAmountPaid > 0 ? existingPayment.method || ('pre-paid' as const) : ('not-paid' as const),
    status: nextBalanceDue <= 0 ? ('paid' as const) : nextAmountPaid > 0 ? ('partial' as const) : ('unpaid' as const),
    collectedAt: nextAmountPaid > 0 ? existingPayment.collectedAt : null,
  }
}
