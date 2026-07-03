'use server'

import Stripe from 'stripe'
import { getPayload } from 'payload'
import config from '@payload-config'
import { headers } from 'next/headers'

import {
  applyAvailableClientCredit,
  applyIncomingPayment,
  type PaymentMethod,
} from '@/collections/Payments/services/applyPayment'
import type { SubstanceValue } from '@/fields/substanceOptions'
import { baseUrl } from '@/utilities/baseUrl'
import { withPayloadTransaction } from '@/collections/Payments/services/withPayloadTransaction'

function getRelationshipId(value: unknown): string | null {
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: unknown }).id
    if (typeof id === 'string' || typeof id === 'number') return String(id)
  }
  return null
}

type TrackerRelatedClient = {
  id?: unknown
  firstName?: unknown
  lastName?: unknown
  email?: unknown
}

type TrackerDoc = {
  id?: unknown
  relatedClient?: unknown
  collectionDate?: unknown
  testType?: unknown
  initialScreenResult?: unknown
  confirmationDecision?: unknown
  confirmationResults?: unknown
  confirmationSubstances?: unknown
  unexpectedPositives?: unknown
  isComplete?: unknown
  processNotes?: unknown
  payment?: {
    balanceDue?: unknown
  } | null
}

function readBalanceDue(test: { payment?: { balanceDue?: unknown } | null }) {
  return typeof test.payment?.balanceDue === 'number' ? Math.max(0, test.payment.balanceDue) : 0
}

async function getAdminPayload() {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await headers() })

  if (!user || user.collection !== 'admins') {
    throw new Error('Unauthorized - admin access required.')
  }

  return payload
}

function toTrackerTest(doc: TrackerDoc) {
  const relatedClient =
    typeof doc.relatedClient === 'object' && doc.relatedClient ? (doc.relatedClient as TrackerRelatedClient) : null

  return {
    id: String(doc.id),
    relatedClient: relatedClient
      ? {
          id: String(relatedClient.id),
          firstName: typeof relatedClient.firstName === 'string' ? relatedClient.firstName : '',
          lastName: typeof relatedClient.lastName === 'string' ? relatedClient.lastName : '',
          email: typeof relatedClient.email === 'string' ? relatedClient.email : '',
        }
      : undefined,
    collectionDate: typeof doc.collectionDate === 'string' ? doc.collectionDate : '',
    testType: typeof doc.testType === 'string' ? doc.testType : '',
    initialScreenResult: typeof doc.initialScreenResult === 'string' ? doc.initialScreenResult : undefined,
    confirmationDecision: typeof doc.confirmationDecision === 'string' ? doc.confirmationDecision : undefined,
    confirmationResults: Array.isArray(doc.confirmationResults) ? doc.confirmationResults : undefined,
    confirmationSubstances: Array.isArray(doc.confirmationSubstances) ? doc.confirmationSubstances : undefined,
    unexpectedPositives: Array.isArray(doc.unexpectedPositives) ? doc.unexpectedPositives : undefined,
    isComplete: doc.isComplete === true,
    processNotes: typeof doc.processNotes === 'string' ? doc.processNotes : undefined,
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

async function fetchTrackerTests(payload: Awaited<ReturnType<typeof getPayload>>) {
  const result = await payload.find({
    collection: 'drug-tests',
    where: {
      or: [
        {
          isComplete: {
            equals: false,
          },
        },
        {
          'payment.balanceDue': {
            greater_than: 0,
          },
        },
      ],
    },
    depth: 1,
    limit: 100,
    sort: '-collectionDate',
    overrideAccess: true,
  })

  return result.docs.map(toTrackerTest)
}

async function voidPendingPayment(payload: Awaited<ReturnType<typeof getPayload>>, paymentId: string | number) {
  try {
    await payload.update({
      collection: 'payments',
      id: paymentId,
      data: {
        status: 'voided',
        voidedAt: new Date().toISOString(),
      },
      overrideAccess: true,
    })
  } catch (err) {
    payload.logger.warn({ msg: `Failed to void pending payment ${paymentId}`, err })
  }
}

async function expireCheckoutSession(
  payload: Awaited<ReturnType<typeof getPayload>>,
  stripe: Stripe,
  sessionId: string,
) {
  try {
    await stripe.checkout.sessions.expire(sessionId)
  } catch (err) {
    payload.logger.warn({ msg: `Failed to expire Stripe checkout session ${sessionId}`, err })
  }
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

  const payload = await getAdminPayload()
  try {
    await withPayloadTransaction(payload, async (req) => {
      const test = await payload.findByID({
        collection: 'drug-tests',
        id: input.testId,
        depth: 1,
        overrideAccess: true,
        req,
      })
      const clientId = getRelationshipId(test.relatedClient)

      if (!clientId) {
        throw new Error('Unable to identify the client for this test.')
      }

      await applyIncomingPayment({
        payload,
        clientId,
        amount: input.amount,
        method: input.method,
        source: 'test-tracker',
        relatedDrugTest: input.testId,
        req,
      })
    })
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unable to record payment.',
    }
  }

  return {
    success: true,
    test: await fetchTrackerTest(payload, input.testId),
    tests: await fetchTrackerTests(payload),
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

  const payload = await getAdminPayload()
  try {
    await withPayloadTransaction(payload, async (req) => {
      const test = await payload.findByID({
        collection: 'drug-tests',
        id: input.testId,
        depth: 1,
        overrideAccess: true,
        req,
      })
      const clientId = getRelationshipId(test.relatedClient)

      if (!clientId) {
        throw new Error('Unable to identify the client for this test.')
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
        req,
      })

      await applyAvailableClientCredit({
        payload,
        clientId,
        relatedDrugTest: input.testId,
        req,
      })
    })
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unable to request confirmation.',
    }
  }

  return {
    success: true,
    test: await fetchTrackerTest(payload, input.testId),
    tests: await fetchTrackerTests(payload),
  }
}

export async function sendDrugTestStripePaymentLink(testId: string) {
  if (!testId) {
    return { success: false, error: 'Drug test is required.' }
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return { success: false, error: 'Stripe is not configured.' }
  }

  const payload = await getAdminPayload()
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

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {})
  let pendingPaymentId: string | number | null = null
  let session: Stripe.Checkout.Session | null = null

  try {
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
      },
      overrideAccess: true,
    })
    pendingPaymentId = pendingPayment.id

    session = await stripe.checkout.sessions.create({
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
      throw new Error('Stripe did not return a checkout URL.')
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

    const paymentLinkEmailSentAt = new Date().toISOString()

    try {
      await payload.update({
        collection: 'payments',
        id: pendingPayment.id,
        data: {
          paymentLinkEmailSentAt,
        },
        overrideAccess: true,
      })

      await payload.update({
        collection: 'drug-tests',
        id: test.id,
        data: {
          payment: {
            ...test.payment,
            lastPaymentLinkSentAt: paymentLinkEmailSentAt,
            lastPaymentLinkUrl: session.url,
          },
        },
        overrideAccess: true,
      })
    } catch (err) {
      payload.logger.warn({
        msg: `Payment link email sent but follow-up metadata update failed for test ${test.id}`,
        err,
      })
    }

    let updatedTest: ReturnType<typeof toTrackerTest> | undefined
    try {
      updatedTest = await fetchTrackerTest(payload, testId)
    } catch (err) {
      payload.logger.warn({ msg: `Payment link email sent but tracker refresh failed for test ${test.id}`, err })
    }

    return {
      success: true,
      checkoutUrl: session.url,
      test: updatedTest,
    }
  } catch (error) {
    if (session?.id) {
      await expireCheckoutSession(payload, stripe, session.id)
    }

    if (pendingPaymentId) {
      await voidPendingPayment(payload, pendingPaymentId)
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unable to send payment link.',
    }
  }
}
