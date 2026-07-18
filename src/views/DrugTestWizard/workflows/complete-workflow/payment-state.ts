export type GuidedPaymentChoice = 'paid' | 'still-owes'
export type GuidedPaymentEntryMethod = 'cash' | 'card' | 'pre-paid'

export type GuidedPaymentDraft = {
  amountDue: number
  amountPaid: number
  choice: GuidedPaymentChoice | null
  method: GuidedPaymentEntryMethod
}

function normalizeCollectedAmount(value: number) {
  return Number.isFinite(value) ? Math.max(0, value) : 0
}

export function updateStillOwesAmount(payment: GuidedPaymentDraft, value: number): GuidedPaymentDraft {
  const amountPaid = normalizeCollectedAmount(value)

  if (payment.amountDue > 0 && amountPaid >= payment.amountDue) {
    return {
      ...payment,
      choice: 'paid',
      amountPaid,
      method: payment.method === 'pre-paid' ? 'cash' : payment.method,
    }
  }

  return {
    ...payment,
    amountPaid,
  }
}

export function updatePaidAmount(payment: GuidedPaymentDraft, value: number): GuidedPaymentDraft {
  const amountPaid = Math.max(payment.amountDue, normalizeCollectedAmount(value))

  return {
    ...payment,
    amountPaid,
    method: amountPaid > payment.amountDue && payment.method === 'pre-paid' ? 'cash' : payment.method,
  }
}
