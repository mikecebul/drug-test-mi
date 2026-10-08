import type { Payload, PayloadRequest } from 'payload'
import {
  confirmationPaid,
  confirmationRemaining,
  confirmationHoldExpired,
} from '@/collections/DrugTests/confirmation/policy'
import type { DrugTest } from '@/payload-types'
import { resolveBillingResponsibility } from '@/lib/referral-invoices/payer'

type RelationshipId = string

export type PaymentMethod = 'cash' | 'card' | 'stripe' | 'pre-paid' | 'credit' | 'unknown'
export type PaymentSource =
  | 'guided-workflow'
  | 'test-tracker'
  | 'stripe-checkout'
  | 'referral-invoice'
  | 'calcom'
  | 'credit-application'
  | 'manual'

type PaymentAllocation = {
  drugTest: string
  amount: number
  confirmationAmount?: number
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
  bookingBalanceDue?: number
  allocationOrder?: 'booking-first' | 'oldest-balance-first'
  stripeCheckoutSessionId?: string | null
  stripePaymentIntentId?: string | null
  stripeCheckoutUrl?: string | null
  paymentLinkEmailSentAt?: string | null
  purpose?: 'confirmation'
  confirmationRequestKey?: string | null
  confirmationAllocationDisabled?: boolean
  existingPaymentId?: RelationshipId | null
  req?: Partial<PayloadRequest>
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

// Read every page before changing balances, since payment updates remove rows from this query.
async function unpaidClientTests(payload: Payload, clientId: string, req?: Partial<PayloadRequest>) {
  const tests: DrugTest[] = []
  let page = 1
  let hasNextPage: boolean
  do {
    const result = await payload.find({
      collection: 'drug-tests',
      where: { and: [{ relatedClient: { equals: clientId } }, { 'payment.balanceDue': { greater_than: 0 } }] },
      depth: 0,
      limit: 1000,
      page,
      sort: 'collectionDate',
      overrideAccess: true,
      req,
    })
    tests.push(...result.docs)
    hasNextPage = result.hasNextPage
    page += 1
  } while (hasNextPage)
  return tests
}

async function allocationTests(input: {
  payload: Payload
  clientId: string
  relatedDrugTest?: string | null
  purpose?: 'confirmation'
  confirmationRequestKey?: string | null
  confirmationAllocationDisabled?: boolean
  req?: Partial<PayloadRequest>
}) {
  if (input.purpose !== 'confirmation') return unpaidClientTests(input.payload, input.clientId, input.req)
  if (input.confirmationAllocationDisabled) return []
  if (!input.relatedDrugTest || !input.confirmationRequestKey)
    throw new Error('A confirmation payment must identify its test and request.')
  const test = await input.payload.findByID({
    collection: 'drug-tests',
    id: input.relatedDrugTest,
    depth: 0,
    overrideAccess: true,
    req: input.req,
  })
  if (readRelationshipId(test.relatedClient) !== input.clientId)
    throw new Error('Confirmation payment belongs to a different client.')
  // Settled money from cancelled/expired links becomes credit, never an authorization for a different request.
  if (
    test.confirmationRequestKey !== input.confirmationRequestKey ||
    test.confirmationDecision !== 'request-confirmation' ||
    confirmationHoldExpired(test)
  )
    return []
  return [test]
}

async function updateDrugTestPayment(input: {
  payload: Payload
  drugTest: Pick<DrugTest, 'id' | 'payment'>
  amountApplied: number
  purpose?: 'confirmation'
  method: PaymentMethod
  req?: Partial<PayloadRequest>
}) {
  const existingPayment = input.drugTest.payment || {}
  const amountDue = normalizeMoney(existingPayment.amountDue)
  const previousAmountPaid = normalizeMoney(existingPayment.amountPaid)
  const nextAmountPaid = addMoney(previousAmountPaid, input.amountApplied)
  const feePaid = confirmationPaid(input.drugTest)
  const nextFeePaid = Math.min(
    existingPayment.confirmationFeeDue || 0,
    input.purpose === 'confirmation'
      ? addMoney(feePaid, input.amountApplied)
      : Math.max(feePaid, nextAmountPaid - Math.max(0, amountDue - (existingPayment.confirmationFeeDue || 0))),
  )
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
        confirmationFeePaid: nextFeePaid,
        amountPaid: Math.min(nextAmountPaid, amountDue),
        balanceDue: nextBalanceDue,
        lastPaymentAt: new Date().toISOString(),
      },
    },
    overrideAccess: true,
    req: input.req,
    context: { confirmationAllocation: true },
  })
}

export async function getClientCreditBalance(
  payload: Payload,
  clientId: RelationshipId,
  req?: Partial<PayloadRequest>,
): Promise<number> {
  const client = await payload.findByID({
    collection: 'clients',
    id: clientId,
    depth: 0,
    overrideAccess: true,
    req,
  })

  return normalizeMoney((client as { creditBalance?: number | null }).creditBalance)
}

async function addClientCredit(
  payload: Payload,
  clientId: RelationshipId,
  amount: number,
  req?: Partial<PayloadRequest>,
) {
  const normalizedAmount = normalizeMoney(amount)
  if (normalizedAmount <= 0) return

  const currentCredit = await getClientCreditBalance(payload, clientId, req)

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
    req,
  })
}

export async function applyIncomingPayment(input: ApplyIncomingPaymentInput) {
  const amount = normalizeMoney(input.amount)
  const allocationOrder = input.allocationOrder || 'booking-first'
  const bookingReservationLimit = normalizeMoney(input.bookingBalanceDue ?? input.reservedForBookingAmount)
  let reservedForBookingAmount = allocationOrder === 'booking-first' ? Math.min(bookingReservationLimit, amount) : 0
  let remaining = subtractMoney(amount, reservedForBookingAmount)
  const allocations: PaymentAllocation[] = []

  if (remaining > 0) {
    const unpaidTests = await allocationTests(input)
    for (const test of unpaidTests) {
      if (remaining <= 0) break
      if (test.payment?.status === 'invoiced' || test.payment?.referralInvoice) continue
      if ((await resolveBillingResponsibility(input.payload, test, input.clientId, input.req)).payer === 'referral')
        continue

      const balanceDue =
        input.purpose === 'confirmation' ? confirmationRemaining(test) : normalizeMoney(test.payment?.balanceDue)
      if (balanceDue <= 0) continue

      const amountApplied = Math.min(balanceDue, remaining)
      const previousConfirmationPaid = confirmationPaid(test)
      const updatedTest = await updateDrugTestPayment({
        payload: input.payload,
        drugTest: test,
        amountApplied,
        purpose: input.purpose,
        method: input.method,
        req: input.req,
      })

      allocations.push({
        drugTest: String(test.id),
        amount: amountApplied,
        confirmationAmount: Math.max(0, subtractMoney(confirmationPaid(updatedTest), previousConfirmationPaid)),
      })
      remaining = subtractMoney(remaining, amountApplied)
    }
  }

  if (allocationOrder === 'oldest-balance-first' && remaining > 0 && bookingReservationLimit > 0) {
    reservedForBookingAmount = Math.min(bookingReservationLimit, remaining)
    remaining = subtractMoney(remaining, reservedForBookingAmount)
  }

  const appliedAmount = allocations.reduce((total, allocation) => addMoney(total, allocation.amount), 0)
  const creditAmount = Math.max(0, remaining)

  if (creditAmount > 0) {
    await addClientCredit(input.payload, input.clientId, creditAmount, input.req)
  }

  if (input.purpose === 'confirmation' && creditAmount > 0) {
    await input.payload.create({
      collection: 'admin-alerts',
      overrideAccess: true,
      req: input.req,
      data: {
        title: 'Confirmation payment needs review',
        severity: 'high',
        alertType: 'data-integrity',
        message: `A confirmation payment retained $${creditAmount.toFixed(2)} as account credit because its request was changed, expired, or already funded. Review for a refund. No lab request was authorized by this credit.`,
        context: {
          testId: input.relatedDrugTest,
          paymentId: input.existingPaymentId,
          confirmationRequestKey: input.confirmationRequestKey,
        },
        resolved: false,
      },
    })
  }
  const paymentData = {
    purpose: input.purpose,
    confirmationRequestKey: input.confirmationRequestKey || undefined,
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
      req: input.req,
    })
  }

  return input.payload.create({
    collection: 'payments',
    data: paymentData,
    overrideAccess: true,
    req: input.req,
  })
}

export async function applyAvailableClientCredit(input: {
  payload: Payload
  clientId: RelationshipId
  amount?: number
  purpose?: 'confirmation'
  confirmationRequestKey?: string | null
  relatedBooking?: RelationshipId | null
  relatedDrugTest?: RelationshipId | null
  bookingBalanceDue?: number
  allocationOrder?: 'booking-first' | 'oldest-balance-first'
  req?: Partial<PayloadRequest>
}) {
  const availableCredit = await getClientCreditBalance(input.payload, input.clientId, input.req)
  if (availableCredit <= 0) return null

  const requestedCredit = input.amount === undefined ? availableCredit : normalizeMoney(input.amount)
  if (requestedCredit <= 0) return null
  if (requestedCredit > availableCredit) {
    throw new Error('The client credit balance changed. Refresh and try again.')
  }

  const allocationOrder = input.allocationOrder || 'booking-first'
  const bookingReservationLimit = normalizeMoney(input.bookingBalanceDue)
  let reservedForBookingAmount =
    allocationOrder === 'booking-first' ? Math.min(bookingReservationLimit, requestedCredit) : 0
  let remainingCredit = subtractMoney(requestedCredit, reservedForBookingAmount)

  const allocations: PaymentAllocation[] = []
  if (remainingCredit > 0) {
    const unpaidTests = await allocationTests(input)
    for (const test of unpaidTests) {
      if (remainingCredit <= 0) break
      if (test.payment?.status === 'invoiced' || test.payment?.referralInvoice) continue
      if ((await resolveBillingResponsibility(input.payload, test, input.clientId, input.req)).payer === 'referral')
        continue

      const balanceDue =
        input.purpose === 'confirmation' ? confirmationRemaining(test) : normalizeMoney(test.payment?.balanceDue)
      if (balanceDue <= 0) continue

      const amountApplied = Math.min(balanceDue, remainingCredit)
      const previousConfirmationPaid = confirmationPaid(test)
      const updatedTest = await updateDrugTestPayment({
        payload: input.payload,
        drugTest: test,
        amountApplied,
        purpose: input.purpose,
        method: 'credit',
        req: input.req,
      })

      allocations.push({
        drugTest: String(test.id),
        amount: amountApplied,
        confirmationAmount: Math.max(0, subtractMoney(confirmationPaid(updatedTest), previousConfirmationPaid)),
      })
      remainingCredit = subtractMoney(remainingCredit, amountApplied)
    }
  }

  if (allocationOrder === 'oldest-balance-first' && remainingCredit > 0 && bookingReservationLimit > 0) {
    reservedForBookingAmount = Math.min(bookingReservationLimit, remainingCredit)
    remainingCredit = subtractMoney(remainingCredit, reservedForBookingAmount)
  }

  const appliedAmount = allocations.reduce((total, allocation) => addMoney(total, allocation.amount), 0)
  const usedCredit = addMoney(appliedAmount, reservedForBookingAmount)

  if (usedCredit <= 0) return null

  await input.payload.update({
    collection: 'clients',
    id: input.clientId,
    data: {
      creditBalance: subtractMoney(availableCredit, usedCredit),
    },
    overrideAccess: true,
    context: {
      skipClientBalanceSync: true,
    },
    req: input.req,
  })

  const payment = await input.payload.create({
    collection: 'payments',
    data: {
      purpose: input.purpose,
      confirmationRequestKey: input.confirmationRequestKey || undefined,
      relatedClient: input.clientId,
      relatedBooking: input.relatedBooking || undefined,
      relatedDrugTest: input.relatedDrugTest || undefined,
      amount: usedCredit,
      method: 'credit',
      source: 'credit-application',
      status: 'posted',
      reservedForBookingAmount,
      appliedAmount,
      creditAmount: 0,
      allocations,
    },
    overrideAccess: true,
    req: input.req,
  })

  return {
    payment,
    usedCredit,
  }
}

export function readRelationshipId(value: unknown): RelationshipId | null {
  return getRelationshipId(value)
}
