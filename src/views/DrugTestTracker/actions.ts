'use server'

import Stripe from 'stripe'
import { getPayload } from 'payload'
import config from '@payload-config'

import {
  applyAvailableClientCredit,
  applyIncomingPayment,
  type PaymentMethod,
} from '@/collections/Payments/services/applyPayment'
import type { SubstanceValue } from '@/fields/substanceOptions'
import { baseUrl } from '@/utilities/baseUrl'

function getRelationshipId(value: unknown): string | null {
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: unknown }).id
    if (typeof id === 'string' || typeof id === 'number') return String(id)
  }
  return null
}

function readBalanceDue(test: any) {
  return typeof test.payment?.balanceDue === 'number' ? Math.max(0, test.payment.balanceDue) : 0
}

function toTrackerTest(doc: any) {
  const relatedClient = typeof doc.relatedClient === 'object' && doc.relatedClient ? doc.relatedClient : null

  return {
    id: String(doc.id),
    relatedClient: relatedClient
      ? {
          id: String(relatedClient.id),
          firstName: relatedClient.firstName || '',
          lastName: relatedClient.lastName || '',
          email: relatedClient.email || '',
        }
      : undefined,
    collectionDate: doc.collectionDate || '',
    testType: doc.testType || '',
    initialScreenResult: doc.initialScreenResult || undefined,
    confirmationDecision: doc.confirmationDecision || undefined,
    confirmationResults: Array.isArray(doc.confirmationResults) ? doc.confirmationResults : undefined,
    confirmationSubstances: Array.isArray(doc.confirmationSubstances) ? doc.confirmationSubstances : undefined,
    unexpectedPositives: Array.isArray(doc.unexpectedPositives) ? doc.unexpectedPositives : undefined,
    isComplete: doc.isComplete === true,
    processNotes: doc.processNotes || undefined,
    payment: doc.payment || undefined,
  }
}

async function fetchTrackerTest(payload: Awaited<ReturnType<typeof getPayload>>, testId: string | number) {
  const test = await payload.findByID({
    collection: 'drug-tests',
    id: testId,
    depth: 1,
    overrideAccess: true,
  })

  return toTrackerTest(test)
}

export async function recordDrugTestPayment(input: {
  testId: string
  amount: number
  method: Extract<PaymentMethod, 'cash' | 'card' | 'unknown'>
}) {
  if (!input.testId) {
    return { success: false, error: 'Drug test is required.' }
  }

  if (typeof input.amount !== 'number' || input.amount <= 0) {
    return { success: false, error: 'Payment amount must be greater than zero.' }
  }

  const payload = await getPayload({ config })
  const test = await payload.findByID({
    collection: 'drug-tests',
    id: input.testId,
    depth: 1,
    overrideAccess: true,
  })
  const clientId = getRelationshipId(test.relatedClient)

  if (!clientId) {
    return { success: false, error: 'Unable to identify the client for this test.' }
  }

  await applyIncomingPayment({
    payload,
    clientId,
    amount: input.amount,
    method: input.method,
    source: 'test-tracker',
    relatedDrugTest: input.testId,
  })

  return {
    success: true,
    test: await fetchTrackerTest(payload, input.testId),
  }
}

export async function requestDrugTestConfirmation(input: {
  testId: string
  confirmationSubstances: string[]
  bypassPaymentRequirement?: boolean
}) {
  if (!input.testId) {
    return { success: false, error: 'Drug test is required.' }
  }

  if (!input.confirmationSubstances.length) {
    return { success: false, error: 'Select at least one substance for confirmation.' }
  }

  const payload = await getPayload({ config })
  const test = await payload.findByID({
    collection: 'drug-tests',
    id: input.testId,
    depth: 1,
    overrideAccess: true,
  })
  const clientId = getRelationshipId(test.relatedClient)

  if (!clientId) {
    return { success: false, error: 'Unable to identify the client for this test.' }
  }

  const feePerSubstance = test.testType === '17-panel-instant' || test.testType === '15-panel-instant' ? 30 : 45
  const confirmationFeeDue = feePerSubstance * input.confirmationSubstances.length
  const currentPayment = test.payment || {}
  const currentAmountDue = typeof currentPayment.amountDue === 'number' ? currentPayment.amountDue : 0
  const currentAmountPaid = typeof currentPayment.amountPaid === 'number' ? currentPayment.amountPaid : 0
  const previousConfirmationFee =
    typeof currentPayment.confirmationFeeDue === 'number' ? currentPayment.confirmationFeeDue : 0
  const nextAmountDue = Math.max(0, currentAmountDue - previousConfirmationFee + confirmationFeeDue)
  const nextBalanceDue = Math.max(0, nextAmountDue - currentAmountPaid)
  const bypassPaymentRequirement = input.bypassPaymentRequirement === true

  await payload.update({
    collection: 'drug-tests',
    id: input.testId,
    data: {
      confirmationDecision: 'request-confirmation',
      confirmationSubstances: input.confirmationSubstances as SubstanceValue[],
      payment: {
        ...currentPayment,
        status: nextBalanceDue <= 0 ? 'paid' : currentAmountPaid > 0 ? 'partial' : 'unpaid',
        amountDue: nextAmountDue,
        amountPaid: currentAmountPaid,
        balanceDue: nextBalanceDue,
        confirmationFeeDue,
        confirmationPaymentBypassed: bypassPaymentRequirement,
        confirmationPaymentBypassedAt: bypassPaymentRequirement ? new Date().toISOString() : null,
      },
    },
    overrideAccess: true,
  })

  await applyAvailableClientCredit({
    payload,
    clientId,
    relatedDrugTest: input.testId,
  })

  return {
    success: true,
    test: await fetchTrackerTest(payload, input.testId),
  }
}

export async function sendDrugTestStripePaymentLink(testId: string) {
  if (!testId) {
    return { success: false, error: 'Drug test is required.' }
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return { success: false, error: 'Stripe is not configured.' }
  }

  const payload = await getPayload({ config })
  const test = await payload.findByID({
    collection: 'drug-tests',
    id: testId,
    depth: 1,
    overrideAccess: true,
  })
  const client = typeof test.relatedClient === 'object' && test.relatedClient ? test.relatedClient : null
  const clientId = getRelationshipId(test.relatedClient)
  const balanceDue = readBalanceDue(test)

  if (!client || !clientId) {
    return { success: false, error: 'Unable to identify the client for this test.' }
  }

  if (!client.email) {
    return { success: false, error: 'Client does not have an email address.' }
  }

  if (balanceDue <= 0) {
    return { success: false, error: 'This test does not have a balance due.' }
  }

  const pendingPayment = await payload.create({
    collection: 'payments',
    data: {
      relatedClient: clientId,
      relatedDrugTest: testId,
      amount: balanceDue,
      method: 'stripe',
      source: 'stripe-checkout',
      status: 'pending',
      reservedForBookingAmount: 0,
      appliedAmount: 0,
      creditAmount: 0,
      paymentLinkEmailSentAt: new Date().toISOString(),
    },
    overrideAccess: true,
  })

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {})
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    success_url: `${baseUrl}/dashboard/results?payment=success`,
    cancel_url: `${baseUrl}/dashboard/results?payment=cancelled`,
    customer_email: client.email,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: Math.round(balanceDue * 100),
          product_data: {
            name: 'MI Drug Test Balance',
            description: `${client.firstName} ${client.lastName} - ${test.testType}`,
          },
        },
      },
    ],
    metadata: {
      paymentId: String(pendingPayment.id),
      drugTestId: String(test.id),
      clientId: String(clientId),
    },
  })

  if (!session.url) {
    return { success: false, error: 'Stripe did not return a checkout URL.' }
  }

  await payload.update({
    collection: 'payments',
    id: pendingPayment.id,
    data: {
      stripeCheckoutSessionId: session.id,
      stripeCheckoutUrl: session.url,
    },
    overrideAccess: true,
  })

  await payload.update({
    collection: 'drug-tests',
    id: test.id,
    data: {
      payment: {
        ...test.payment,
        lastPaymentLinkSentAt: new Date().toISOString(),
        lastPaymentLinkUrl: session.url,
      },
    },
    overrideAccess: true,
  })

  await payload.sendEmail({
    to: client.email,
    subject: 'MI Drug Test payment link',
    html: `
      <p>Hello ${client.firstName},</p>
      <p>You have a balance of <strong>$${balanceDue.toFixed(2)}</strong> for your MI Drug Test account.</p>
      <p><a href="${session.url}">Pay securely by card</a></p>
      <p>If you have already paid, please disregard this message.</p>
    `,
  })

  return {
    success: true,
    checkoutUrl: session.url,
    test: await fetchTrackerTest(payload, testId),
  }
}
