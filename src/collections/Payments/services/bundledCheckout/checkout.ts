import type { Payment } from '@/payload-types'
import { baseUrl } from '@/utilities/baseUrl'
import type { Payload, PayloadRequest } from 'payload'
import Stripe from 'stripe'
import { readRelationshipId } from '../applyPayment'
import { withPayloadTransaction } from '../withPayloadTransaction'
import { bundleInput, hasSameCharges, previewBundle, toCents } from './charges'
import { emailCheckout } from './email'
import { getCheckoutEmailLink, getStripeCheckoutDestination } from './checkoutLink'
import { getBundleExpiry, reconcileBundledCheckout, settleBundledCheckout, voidBundledCheckout } from './settle'
import { z } from 'zod/v3'

export const sendBundleInput = {
  ...bundleInput,
  expectedEmail: z.string().email().describe('The recipientEmail returned by the preview'),
  requestId: z.string().uuid().describe('Unique ID for this payment request. Reuse it when retrying.'),
}
type SendBundle = z.infer<z.ZodObject<typeof sendBundleInput>>

async function findRequest(payload: Payload, requestId: string) {
  const { docs } = await payload.find({
    collection: 'payments',
    where: { 'bundledCheckout.requestId': { equals: requestId } },
    limit: 1,
    depth: 0,
  })
  return docs[0]
}

async function checkPendingCheckouts(payload: Payload, stripe: Stripe, testIds: string[]) {
  const { docs, hasNextPage } = await payload.find({
    collection: 'payments',
    where: {
      status: { equals: 'pending' },
      source: { equals: 'stripe-checkout' },
      or: [
        { relatedDrugTest: { in: testIds } },
        { activeCheckoutTestIds: { in: testIds } },
      ],
    },
    limit: 100,
    depth: 0,
  })
  if (hasNextPage) throw new Error('Too many pending payment links for the selected tests.')
  for (const payment of docs) {
    if (payment.bundledCheckout?.requestId) {
      await reconcileBundledCheckout(payload, stripe, payment)
      const updated = await payload.findByID({ collection: 'payments', id: payment.id, depth: 0 })
      if (updated.status === 'pending') throw new Error('A selected test already has a pending payment link.')
      continue
    }
    if (!payment.stripeCheckoutSessionId) throw new Error('A selected test already has a pending payment link.')
    const session = await stripe.checkout.sessions.retrieve(payment.stripeCheckoutSessionId)
    if (session.status !== 'expired') throw new Error('A selected test already has a pending payment link.')
    await payload.update({
      collection: 'payments',
      where: { id: { equals: payment.id }, status: { equals: 'pending' } },
      data: { status: 'voided', voidReason: 'Stripe checkout expired' },
      depth: 0,
    })
  }
}

function result(payload: Payload, payment: Payment) {
  const bundle = payment.bundledCheckout
  return {
    paymentId: payment.id,
    requestId: bundle?.requestId,
    status: payment.status,
    recipientEmail: bundle?.recipientEmail,
    totalCents: toCents(payment.amount),
    appliedCents: toCents(payment.appliedAmount),
    unappliedCents: toCents(bundle?.unappliedAmount),
    emailAcceptedAt: payment.paymentLinkEmailSentAt ?? null,
    resendEmailId: bundle?.resendEmailId ?? null,
    checkoutUrl: payment.status === 'pending' && payment.stripeCheckoutUrl ? getCheckoutEmailLink(payload, payment.id) : null,
  }
}

export async function sendBundle(req: PayloadRequest, input: SendBundle, stripe: Stripe) {
  const { payload } = req
  const { clientId, expectedEmail, requestId } = input
  let payment = await findRequest(payload, requestId)
  if (!payment) {
    const preview = await previewBundle(req, clientId, input.charges)
    if (preview.recipientEmail !== expectedEmail) throw new Error('The recipient has changed. Preview the payment again.')
    try {
      await checkPendingCheckouts(payload, stripe, input.charges.map((charge) => charge.testId))
      payment = await withPayloadTransaction(payload, async (transaction) => {
        if (!transaction.transactionID) throw new Error('Bundled checkout requires MongoDB transactions.')
        return payload.create({
          collection: 'payments',
          data: {
            relatedClient: clientId,
            amount: preview.totalCents / 100,
            method: 'stripe',
            source: 'stripe-checkout',
            status: 'pending',
            activeCheckoutTestIds: preview.charges.map((charge) => String(charge.drugTest)),
            bundledCheckout: { requestId, requestedBy: req.user?.id, recipientEmail: expectedEmail, charges: preview.charges },
          },
          req: transaction,
          depth: 0,
        })
      })
    } catch (error) {
      // Another request may have reserved this request ID while Stripe was being checked.
      payment = await findRequest(payload, requestId)
      if (!payment) throw error
    }
  }

  const bundle = payment.bundledCheckout
  const charges = bundle?.charges
  if (
    readRelationshipId(payment.relatedClient) !== clientId || bundle?.recipientEmail !== expectedEmail ||
    !charges || !hasSameCharges(charges, input.charges)
  ) throw new Error('This request ID already belongs to a different payment.')

  if (payment.status !== 'pending') return result(payload, payment)

  let session
  if (payment.stripeCheckoutSessionId) {
    session = await stripe.checkout.sessions.retrieve(payment.stripeCheckoutSessionId)
    if (session.payment_status === 'paid') {
      await settleBundledCheckout(payload, session)
    } else if (session.status === 'expired') {
      await voidBundledCheckout(payload, payment.id)
    } else if (session.status !== 'open') {
      throw new Error('Stripe is still processing this payment.')
    }
    if (session.status !== 'open') {
      return result(payload, await payload.findByID({ collection: 'payments', id: payment.id, depth: 0 }))
    }
  }

  if (payment.paymentLinkEmailSentAt) return result(payload, payment)
  const current = await previewBundle(req, clientId, input.charges)
  if (current.recipientEmail !== expectedEmail) throw new Error('The recipient has changed. Preview the payment again.')

  if (!session) {
    if (getBundleExpiry(payment) <= Date.now() / 1000) {
      await voidBundledCheckout(payload, payment.id)
      return result(payload, await payload.findByID({ collection: 'payments', id: payment.id, depth: 0 }))
    }
    session = await stripe.checkout.sessions.create({
      mode: 'payment',
      success_url: `${baseUrl}/dashboard/results?payment=success`,
      cancel_url: `${baseUrl}/dashboard/results?payment=cancelled`,
      payment_method_types: ['card'],
      adaptive_pricing: { enabled: false },
      automatic_tax: { enabled: false },
      expires_at: getBundleExpiry(payment),
      customer_email: expectedEmail,
      line_items: charges.map((charge) => ({
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: charge.amountCents,
          product_data: { name: charge.label },
        },
      })),
      metadata: { bundledPaymentId: payment.id, clientId },
    }, { idempotencyKey: `bundled-checkout-${payment.id}` })

    if (!session.url || session.status !== 'open') throw new Error('Stripe did not return an active checkout link.')
    payment = await payload.update({
      collection: 'payments',
      id: payment.id,
      data: { stripeCheckoutSessionId: session.id, stripeCheckoutUrl: session.url },
      depth: 0,
    })
  }
  if (!getStripeCheckoutDestination(session.id, payment.stripeCheckoutUrl)) {
    throw new Error('The saved Stripe checkout link is incomplete. No email was sent.')
  }

  const resendEmailId = await emailCheckout(payload, payment.id, expectedEmail, charges, toCents(payment.amount))
  return result(payload, await payload.update({
    collection: 'payments',
    id: payment.id,
    data: {
      paymentLinkEmailSentAt: new Date().toISOString(),
      bundledCheckout: { resendEmailId },
    },
    depth: 0,
  }))
}
