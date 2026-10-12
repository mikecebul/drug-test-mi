import type { DrugTest, Payment } from '@/payload-types'

const id = (value: unknown): string | null =>
  typeof value === 'string' ? value : value && typeof value === 'object' && 'id' in value ? String(value.id) : null
const money = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0)
const round = (value: number) => Math.round(value * 100) / 100

export type TestPaymentHistoryEntry = {
  id: string
  label: string
  amount: number
  date?: string | null
  method?: string
  status: 'posted' | 'pending' | 'voided' | 'refunded' | 'legacy'
}

/** Only show the part of an account payment allocated to this test. */
export function testPaymentHistory(test: Partial<DrugTest>, payments: Partial<Payment>[]): TestPaymentHistoryEntry[] {
  const entries: TestPaymentHistoryEntry[] = []
  for (const payment of payments) {
    const allocations = payment.allocations || []
    const matching = allocations.filter((row) => id(row.drugTest) === test.id)
    const allocated = matching.reduce((sum, row) => sum + money(row.amount), 0)
    const direct = id(payment.relatedDrugTest) === test.id
    const amount = round(
      allocations.length
        ? allocated
        : direct
          ? Math.max(0, money(payment.amount) - money(payment.creditAmount) - money(payment.reservedForBookingAmount))
          : 0,
    )
    if (!amount || !payment.status) continue
    const confirmationOnly =
      payment.purpose === 'confirmation' ||
      (matching.length > 0 && matching.every((row) => money(row.confirmationAmount) === money(row.amount)))
    const screeningOnly = matching.length > 0 && matching.every((row) => money(row.confirmationAmount) === 0)
    entries.push({
      id: payment.id || `payment-${entries.length}`,
      amount,
      label:
        payment.status === 'pending'
          ? confirmationOnly
            ? 'Confirmation payment link'
            : 'Payment pending'
          : confirmationOnly
            ? 'Confirmation payment'
            : screeningOnly
              ? 'Screening payment'
              : 'Test payment',
      status: payment.status,
      date: payment.postedAt || payment.collectedAt || payment.createdAt,
      method:
        payment.method === 'unknown'
          ? undefined
          : payment.method === 'credit'
            ? 'Account credit'
            : payment.method === 'pre-paid'
              ? 'Prepaid'
              : payment.method || undefined,
    })
  }
  // The snapshot may retain earlier payments that predate the ledger; never invent a method or date.
  const posted = entries.filter((row) => row.status === 'posted').reduce((sum, row) => sum + row.amount, 0)
  const earlier = round(Math.max(0, money(test.payment?.amountPaid) - posted))
  if (earlier) entries.push({ id: 'earlier-payment', label: 'Earlier payment', amount: earlier, status: 'legacy' })
  return entries.sort((a, b) => (Date.parse(b.date || '') || 0) - (Date.parse(a.date || '') || 0))
}

/** A confirmation-only snapshot on a pre-booking test cannot establish a free screening. */
export function hasMissingScreeningPayment(test: Partial<DrugTest>, payments: Partial<Payment>[]) {
  return (
    !test.sourceBooking &&
    money(test.payment?.confirmationFeeDue) > 0 &&
    money(test.payment?.amountDue) === money(test.payment?.confirmationFeeDue) &&
    !payments.some(
      (payment) =>
        payment.status === 'posted' &&
        payment.purpose !== 'confirmation' &&
        (payment.allocations?.length
          ? payment.allocations.some(
              (row) => id(row.drugTest) === test.id && money(row.amount) > money(row.confirmationAmount),
            )
          : id(payment.relatedDrugTest) === test.id &&
            money(payment.amount) > money(payment.creditAmount) + money(payment.reservedForBookingAmount)),
    )
  )
}
