import type { Payload } from 'payload'
import type { DrugTest } from '@/payload-types'

type RelationshipId = string

export type PaymentMethod = 'cash' | 'card' | 'stripe' | 'pre-paid' | 'credit' | 'unknown'
export type PaymentSource =
  | 'guided-workflow'
  | 'test-tracker'
  | 'stripe-checkout'
  | 'calcom'
  | 'credit-application'
  | 'manual'

type PaymentAllocation = {
  drugTest: string
  amount: number
}

type ApplyIncomingPaymentInput = {
  payload: Payload
  clientId: RelationshipId
  amount: number
  method: PaymentMethod
  source: PaymentSource
  relatedBooking?: RelationshipId | null
  relatedDrugTest?: RelationshipId | null
  reservedForBookingAmount?: number
  stripeCheckoutSessionId?: string | null
  stripePaymentIntentId?: string | null
  stripeCheckoutUrl?: string | null
  paymentLinkEmailSentAt?: string | null
  existingPaymentId?: RelationshipId | null
}

function getRelationshipId(value: unknown): RelationshipId | null {
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: unknown }).id
    if (typeof id === 'string' || typeof id === 'number') return String(id)
  }
  return null
}

export function normalizeMoney(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0
  return Math.round(value * 100) / 100
}

function addMoney(a: number, b: number) {
  return normalizeMoney(a + b)
}

function subtractMoney(a: number, b: number) {
  return normalizeMoney(a - b)
}

async function updateDrugTestPayment(input: {
  payload: Payload
  drugTest: Pick<DrugTest, 'id' | 'payment'>
  amountApplied: number
  method: PaymentMethod
}) {
  const existingPayment = input.drugTest.payment || {}
  const amountDue = normalizeMoney(existingPayment.amountDue)
  const previousAmountPaid = normalizeMoney(existingPayment.amountPaid)
  const nextAmountPaid = addMoney(previousAmountPaid, input.amountApplied)
  const nextBalanceDue = Math.max(0, subtractMoney(amountDue, nextAmountPaid))

  const nextStatus = nextBalanceDue <= 0 ? 'paid' : nextAmountPaid > 0 ? 'partial' : existingPayment.status || 'unpaid'

  return input.payload.update({
    collection: 'drug-tests',
    id: input.drugTest.id,
    data: {
      payment: {
        ...existingPayment,
        status: nextStatus,
        method: input.method,
        amountDue,
        amountPaid: Math.min(nextAmountPaid, amountDue),
        balanceDue: nextBalanceDue,
        lastPaymentAt: new Date().toISOString(),
      },
    },
    overrideAccess: true,
  })
}

export async function getClientCreditBalance(payload: Payload, clientId: RelationshipId): Promise<number> {
  const client = await payload.findByID({
    collection: 'clients',
    id: clientId,
    depth: 0,
    overrideAccess: true,
  })

  return normalizeMoney((client as { creditBalance?: number | null }).creditBalance)
}

async function addClientCredit(payload: Payload, clientId: RelationshipId, amount: number) {
  const normalizedAmount = normalizeMoney(amount)
  if (normalizedAmount <= 0) return

  const currentCredit = await getClientCreditBalance(payload, clientId)

  await payload.update({
    collection: 'clients',
    id: clientId,
    data: {
      creditBalance: addMoney(currentCredit, normalizedAmount),
    },
    overrideAccess: true,
    context: {
      skipClientBalanceSync: true,
    },
  })
}

export async function applyIncomingPayment(input: ApplyIncomingPaymentInput) {
  const amount = normalizeMoney(input.amount)
  const reservedForBookingAmount = Math.min(normalizeMoney(input.reservedForBookingAmount), amount)
  let remaining = subtractMoney(amount, reservedForBookingAmount)
  const allocations: PaymentAllocation[] = []

  if (remaining > 0) {
    const unpaidTests = await input.payload.find({
      collection: 'drug-tests',
      where: {
        and: [
          {
            relatedClient: {
              equals: input.clientId,
            },
          },
          {
            'payment.balanceDue': {
              greater_than: 0,
            },
          },
        ],
      },
      depth: 0,
      limit: 1000,
      sort: 'collectionDate',
      overrideAccess: true,
    })

    for (const test of unpaidTests.docs) {
      if (remaining <= 0) break

      const balanceDue = normalizeMoney(test.payment?.balanceDue)
      if (balanceDue <= 0) continue

      const amountApplied = Math.min(balanceDue, remaining)
      await updateDrugTestPayment({
        payload: input.payload,
        drugTest: test,
        amountApplied,
        method: input.method,
      })

      allocations.push({
        drugTest: String(test.id),
        amount: amountApplied,
      })
      remaining = subtractMoney(remaining, amountApplied)
    }
  }

  const appliedAmount = allocations.reduce((total, allocation) => addMoney(total, allocation.amount), 0)
  const creditAmount = Math.max(0, remaining)

  if (creditAmount > 0) {
    await addClientCredit(input.payload, input.clientId, creditAmount)
  }

  const paymentData = {
    relatedClient: input.clientId,
    relatedDrugTest: input.relatedDrugTest || undefined,
    relatedBooking: input.relatedBooking || undefined,
    amount,
    method: input.method,
    source: input.source,
    status: 'posted' as const,
    reservedForBookingAmount,
    appliedAmount,
    creditAmount,
    allocations,
    stripeCheckoutSessionId: input.stripeCheckoutSessionId || undefined,
    stripePaymentIntentId: input.stripePaymentIntentId || undefined,
    stripeCheckoutUrl: input.stripeCheckoutUrl || undefined,
    paymentLinkEmailSentAt: input.paymentLinkEmailSentAt || undefined,
  }

  if (input.existingPaymentId) {
    return input.payload.update({
      collection: 'payments',
      id: input.existingPaymentId,
      data: paymentData,
      overrideAccess: true,
    })
  }

  return input.payload.create({
    collection: 'payments',
    data: paymentData,
    overrideAccess: true,
  })
}

export async function applyAvailableClientCredit(input: {
  payload: Payload
  clientId: RelationshipId
  relatedDrugTest?: RelationshipId | null
}) {
  let remainingCredit = await getClientCreditBalance(input.payload, input.clientId)
  if (remainingCredit <= 0) return null

  const allocations: PaymentAllocation[] = []
  const unpaidTests = await input.payload.find({
    collection: 'drug-tests',
    where: {
      and: [
        {
          relatedClient: {
            equals: input.clientId,
          },
        },
        {
          'payment.balanceDue': {
            greater_than: 0,
          },
        },
      ],
    },
    depth: 0,
    limit: 1000,
    sort: 'collectionDate',
    overrideAccess: true,
  })

  for (const test of unpaidTests.docs) {
    if (remainingCredit <= 0) break

    const balanceDue = normalizeMoney(test.payment?.balanceDue)
    if (balanceDue <= 0) continue

    const amountApplied = Math.min(balanceDue, remainingCredit)
    await updateDrugTestPayment({
      payload: input.payload,
      drugTest: test,
      amountApplied,
      method: 'credit',
    })

    allocations.push({
      drugTest: String(test.id),
      amount: amountApplied,
    })
    remainingCredit = subtractMoney(remainingCredit, amountApplied)
  }

  const usedCredit = allocations.reduce((total, allocation) => addMoney(total, allocation.amount), 0)

  if (usedCredit <= 0) return null

  await input.payload.update({
    collection: 'clients',
    id: input.clientId,
    data: {
      creditBalance: remainingCredit,
    },
    overrideAccess: true,
    context: {
      skipClientBalanceSync: true,
    },
  })

  const payment = await input.payload.create({
    collection: 'payments',
    data: {
      relatedClient: input.clientId,
      relatedDrugTest: input.relatedDrugTest || undefined,
      amount: usedCredit,
      method: 'credit',
      source: 'credit-application',
      status: 'posted',
      reservedForBookingAmount: 0,
      appliedAmount: usedCredit,
      creditAmount: 0,
      allocations,
    },
    overrideAccess: true,
  })

  return {
    payment,
    usedCredit,
  }
}

export function readRelationshipId(value: unknown): RelationshipId | null {
  return getRelationshipId(value)
}
