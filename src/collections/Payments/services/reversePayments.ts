import type { DrugTest, Payment } from '@/payload-types'
import type { Payload, PayloadRequest } from 'payload'

import { getClientCreditBalance, normalizeMoney, readRelationshipId } from './applyPayment'

type ReversiblePayment = Pick<
  Payment,
  'allocations' | 'amount' | 'creditAmount' | 'id' | 'method' | 'source' | 'status'
>

function addMoney(a: number, b: number) {
  return normalizeMoney(a + b)
}

function subtractMoney(a: number, b: number) {
  return normalizeMoney(a - b)
}

function getCreditRestored(payment: ReversiblePayment) {
  return payment.method === 'credit' || payment.source === 'credit-application' ? normalizeMoney(payment.amount) : 0
}

export async function reversePostedPayments(input: {
  payload: Payload
  clientId: string
  payments: ReversiblePayment[]
  reason: string
  req?: Partial<PayloadRequest>
}) {
  const payments = input.payments.filter((payment) => payment.status === 'posted')
  if (payments.length === 0) {
    throw new Error('No posted payments are available to undo.')
  }

  const creditRestored = payments.reduce((total, payment) => addMoney(total, getCreditRestored(payment)), 0)
  const creditRemoved = payments.reduce((total, payment) => addMoney(total, normalizeMoney(payment.creditAmount)), 0)
  const currentCredit = await getClientCreditBalance(input.payload, input.clientId, input.req)
  const nextCredit = addMoney(currentCredit, subtractMoney(creditRestored, creditRemoved))

  if (nextCredit < 0) {
    throw new Error(
      'This payment created credit that has since been used. Restore that credit before undoing the payment.',
    )
  }

  const allocationReversals = new Map<string, number>()
  for (const payment of payments) {
    for (const allocation of payment.allocations || []) {
      const drugTestId = readRelationshipId(allocation.drugTest)
      if (!drugTestId) continue
      allocationReversals.set(
        drugTestId,
        addMoney(allocationReversals.get(drugTestId) || 0, normalizeMoney(allocation.amount)),
      )
    }
  }

  for (const [drugTestId, amountToReverse] of allocationReversals) {
    const drugTest = await input.payload.findByID({
      collection: 'drug-tests',
      id: drugTestId,
      depth: 0,
      overrideAccess: true,
      req: input.req,
    })
    const existingPayment = drugTest.payment || ({} as NonNullable<DrugTest['payment']>)
    const amountDue = normalizeMoney(existingPayment.amountDue)
    const amountPaid = normalizeMoney(existingPayment.amountPaid)
    const nextAmountPaid = Math.max(0, subtractMoney(amountPaid, amountToReverse))
    const balanceDue = Math.max(0, subtractMoney(amountDue, nextAmountPaid))

    await input.payload.update({
      collection: 'drug-tests',
      id: drugTestId,
      data: {
        payment: {
          ...existingPayment,
          status: balanceDue <= 0 ? 'paid' : nextAmountPaid > 0 ? 'partial' : 'unpaid',
          amountDue,
          amountPaid: nextAmountPaid,
          balanceDue,
        },
      },
      overrideAccess: true,
      req: input.req,
    })
  }

  if (nextCredit !== currentCredit) {
    await input.payload.update({
      collection: 'clients',
      id: input.clientId,
      data: {
        creditBalance: nextCredit,
      },
      overrideAccess: true,
      context: {
        skipClientBalanceSync: true,
      },
      req: input.req,
    })
  }

  const voidedAt = new Date().toISOString()
  for (const payment of payments) {
    await input.payload.update({
      collection: 'payments',
      id: payment.id,
      data: {
        status: 'voided',
        voidedAt,
        voidReason: input.reason,
      },
      overrideAccess: true,
      req: input.req,
    })
  }

  return {
    creditRemoved,
    creditRestored,
    nextCredit,
    reversedAllocationAmount: Array.from(allocationReversals.values()).reduce(addMoney, 0),
    voidedPaymentCount: payments.length,
  }
}
