import Stripe from 'stripe'
import { closePendingClientCheckoutSessions } from '@/collections/Payments/services/closePendingClientCheckoutSessions'
import type { Payload, Where } from 'payload'
import type { DrugTest } from '@/payload-types'
import { createElement } from 'react'
import { render } from '@react-email/components'
import { baseUrl } from '@/utilities/baseUrl'
import { readRelationshipId } from '@/collections/Payments/services/applyPayment'
import { resolveClientReceiptEmail } from '@/collections/Payments/services/clientReceipt'
import { withPayloadTransaction } from '@/collections/Payments/services/withPayloadTransaction'
import { prefixNonLiveEmailSubject, resolveOutboundNotificationRecipients } from '@/lib/email-safety'
import {
  confirmationHoldExpired,
  confirmationPaymentRequired,
  confirmationRemaining,
  referralPaysConfirmation,
} from './policy'

/** Caller authenticates and validates the decision. Reuse a current request on Back/Next retries. */
export async function sendConfirmationPaymentLink(payload: Payload, testId: string, stripe?: Stripe, resend = false) {
  const key = process.env.STRIPE_SECRET_KEY
  if (!stripe && !key) throw new Error('Stripe is not configured.')
  stripe ||= new Stripe(key!, {})
  const prepared = await withPayloadTransaction(payload, async (req) => {
    const test = await payload.findByID({ collection: 'drug-tests', id: testId, depth: 0, overrideAccess: true, req })
    if (referralPaysConfirmation(test))
      throw new Error('Confirmation is billed to the referral; do not send a client payment link.')
    if (test.confirmationDecision !== 'request-confirmation' || !test.confirmationRequestKey)
      throw new Error('Choose confirmation before sending a payment link.')
    if (!confirmationPaymentRequired(test)) return null
    if (confirmationHoldExpired(test)) throw new Error('The laboratory hold has ended.')
    const clientId = readRelationshipId(test.relatedClient)
    if (!clientId) throw new Error('Client not found.')
    const client = await payload.findByID({
      collection: 'clients',
      id: clientId,
      depth: 0,
      overrideAccess: true,
      req,
    })
    const email = resolveClientReceiptEmail(client)
    if (!email) throw new Error('The client needs an enabled email address to receive a payment link.')
    const amount = confirmationRemaining(test)
    const pending = await payload.find({
      collection: 'payments',
      where: {
        and: [
          { relatedDrugTest: { equals: testId } },
          { purpose: { equals: 'confirmation' } },
          { confirmationRequestKey: { equals: test.confirmationRequestKey } },
          { status: { equals: 'pending' } },
        ],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
      req,
    })
    let payment = pending.docs[0]
    if (!payment) {
      const history = await payload.find({
        collection: 'payments',
        where: {
          and: [
            { relatedDrugTest: { equals: testId } },
            { purpose: { equals: 'confirmation' } },
            { confirmationRequestKey: { equals: test.confirmationRequestKey } },
          ],
        },
        sort: ['-createdAt', '-id'],
        limit: 1,
        depth: 0,
        overrideAccess: true,
        req,
      })
      // The existing unique ledger key prevents two pending records for one checkout attempt,
      // including on standalone MongoDB. Expired/voided attempts get a new key.
      const previous = history.docs[0]
      const operationId = `confirmation-link:${testId}:${test.confirmationRequestKey}:${previous?.id || 'first'}`
      if (previous?.status === 'pending') payment = previous
      else
        try {
          payment = await payload.create({
            collection: 'payments',
            overrideAccess: true,
            req,
            data: {
              relatedClient: clientId,
              relatedDrugTest: testId,
              purpose: 'confirmation',
              confirmationRequestKey: test.confirmationRequestKey,
              amount,
              method: 'stripe',
              source: 'stripe-checkout',
              status: 'pending',
              accountOperationId: operationId,
            },
          })
        } catch (error) {
          if (await req.transactionID) throw error
          const saved = await payload.find({
            collection: 'payments',
            where: { accountOperationId: { equals: operationId } },
            limit: 1,
            depth: 0,
            overrideAccess: true,
            req,
          })
          if (!saved.docs[0] || saved.docs[0].status !== 'pending') throw error
          payment = saved.docs[0]
        }
    }
    return { test, client, email, payment, amount, clientId }
  })
  if (!prepared) return { sent: false }
  const { test, client, email, payment, amount, clientId } = prepared
  if (payment.amount !== amount) {
    await closePendingClientCheckoutSessions(payload, stripe, testId, 'confirmation')
    return sendConfirmationPaymentLink(payload, testId, stripe, resend)
  }
  let session: Stripe.Checkout.Session
  if (payment.stripeCheckoutSessionId) {
    session = await stripe.checkout.sessions.retrieve(payment.stripeCheckoutSessionId)
    if (session.status === 'complete') return { sent: false }
    if (session.status === 'expired') {
      await payload.update({
        collection: 'payments',
        id: payment.id,
        overrideAccess: true,
        data: { status: 'voided', voidReason: 'Confirmation link expired' },
      })
      return sendConfirmationPaymentLink(payload, testId, stripe, resend)
    }
  } else {
    const now = Math.floor(Date.now() / 1000)
    const expiresAt = Math.min(now + 24 * 60 * 60, Math.floor(new Date(test.confirmationHoldUntil!).getTime() / 1000))
    if (expiresAt < now + 30 * 60)
      throw new Error('The laboratory hold ends in less than 30 minutes. Contact the lab before taking payment.')
    session = await stripe.checkout.sessions.create(
      {
        mode: 'payment',
        payment_method_types: ['card'],
        customer_email: email,
        expires_at: expiresAt,
        success_url: `${baseUrl}/dashboard/results?payment=success`,
        cancel_url: `${baseUrl}/dashboard/results?payment=cancelled`,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: 'usd',
              unit_amount: Math.round(amount * 100),
              product_data: { name: 'Confirmation testing fee' },
            },
          },
        ],
        metadata: {
          paymentId: payment.id,
          drugTestId: testId,
          clientId,
          purpose: 'confirmation',
          confirmationRequestKey: test.confirmationRequestKey!,
        },
      },
      { idempotencyKey: `confirmation-checkout-${payment.id}` },
    )
    if (!session.url) throw new Error('Stripe did not return a payment link.')
    await payload.update({
      collection: 'payments',
      id: payment.id,
      overrideAccess: true,
      data: { stripeCheckoutSessionId: session.id, stripeCheckoutUrl: session.url },
    })
  }
  const latest = await payload.findByID({ collection: 'drug-tests', id: testId, depth: 0, overrideAccess: true })
  if (latest.confirmationRequestKey !== test.confirmationRequestKey || confirmationRemaining(latest) !== amount) {
    if (session.status === 'open') {
      await stripe.checkout.sessions.expire(session.id)
      await payload.update({
        collection: 'payments',
        id: payment.id,
        overrideAccess: true,
        data: { status: 'voided', voidReason: 'Confirmation changed before the payment email was sent' },
      })
    }
    throw new Error('The confirmation balance changed. Review it before sending a payment link.')
  }
  if (payment.paymentLinkEmailSentAt && !resend) return { sent: false, checkoutUrl: session.url }
  if (!session.url) throw new Error('Stripe did not return a payment link.')
  const html = await render(
    createElement(
      'div',
      null,
      createElement('p', null, `Hello ${client.firstName},`),
      createElement(
        'p',
        null,
        `Pay $${amount.toFixed(2)} for the requested confirmation testing. Staff will request it from the lab after payment clears.`,
      ),
      createElement(
        'p',
        null,
        `The laboratory hold ends ${new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'America/Detroit' }).format(new Date(test.confirmationHoldUntil!))}.`,
      ),
      createElement('a', { href: session.url }, 'Pay confirmation fee securely'),
    ),
  )
  const recipients = resolveOutboundNotificationRecipients([email])
  const claimAt = new Date().toISOString()
  const claim: Where[] = [
    { id: { equals: payment.id } },
    { status: { equals: 'pending' } },
    {
      or: [
        { paymentLinkEmailSendingAt: { exists: false } },
        { paymentLinkEmailSendingAt: { equals: null } },
        { paymentLinkEmailSendingAt: { less_than: new Date(Date.now() - 5 * 60_000).toISOString() } },
      ],
    },
  ]
  if (!resend)
    claim.push({ or: [{ paymentLinkEmailSentAt: { exists: false } }, { paymentLinkEmailSentAt: { equals: null } }] })
  const claimed = await payload.db.updateOne({
    collection: 'payments',
    where: { and: claim },
    data: { paymentLinkEmailSendingAt: claimAt },
  })
  if (!claimed) return { sent: false, checkoutUrl: session.url }
  try {
    await payload.sendEmail({
      to: recipients.recipients,
      subject: prefixNonLiveEmailSubject('Confirmation testing payment link'),
      html,
    })
  } catch (error) {
    await payload.db.updateOne({
      collection: 'payments',
      where: { and: [{ id: { equals: payment.id } }, { paymentLinkEmailSendingAt: { equals: claimAt } }] },
      data: { paymentLinkEmailSendingAt: null },
    })
    throw error
  }
  const sentAt = new Date().toISOString()
  await payload.update({
    collection: 'payments',
    id: payment.id,
    overrideAccess: true,
    data: { paymentLinkEmailSentAt: sentAt, paymentLinkEmailSendingAt: null },
  })
  // The adapter transforms named groups, so use the complete stored snapshot and a
  // version check instead of dotted group fields or a stale payment object.
  for (let attempt = 0; attempt < 3; attempt++) {
    const current = (await payload.db.findOne({
      collection: 'drug-tests',
      where: { id: { equals: testId } },
    })) as unknown as DrugTest | null
    if (!current) break
    const data: Record<string, unknown> = {
      ...current,
      payment: { ...current.payment, lastPaymentLinkSentAt: sentAt, lastPaymentLinkUrl: session.url },
      updatedAt: new Date(Math.max(Date.now(), Date.parse(current.updatedAt) + 1)).toISOString(),
    }
    delete data.id
    const updated = await payload.db.updateOne({
      collection: 'drug-tests',
      where: { and: [{ id: { equals: testId } }, { updatedAt: { equals: current.updatedAt } }] },
      data,
    })
    if (updated) break
  }
  return { sent: true, checkoutUrl: session.url }
}
