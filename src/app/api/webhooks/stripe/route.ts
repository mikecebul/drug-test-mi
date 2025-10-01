import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import Stripe from 'stripe'
import {
  handleCheckoutSessionCompleted,
  handleSubscriptionUpdated,
  handleSubscriptionDeleted,
  handleInvoicePaymentSucceeded,
  handleInvoicePaymentFailed,
} from '@/plugins/stripe/webhooks/subscriptionHandlers'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-09-30.clover',
})

const webhookSecret = process.env.STRIPE_WEBHOOKS_SIGNING_SECRET || ''

export async function POST(req: NextRequest) {
  const payload = await getPayload({ config })

  payload.logger.info('='.repeat(60))
  payload.logger.info('🎯 STRIPE WEBHOOK ENDPOINT CALLED')
  payload.logger.info('='.repeat(60))

  try {
    const body = await req.text()
    const sig = req.headers.get('stripe-signature')

    if (!sig) {
      payload.logger.error('❌ No Stripe signature found in request')
      return NextResponse.json({ error: 'No signature' }, { status: 400 })
    }

    if (!webhookSecret) {
      payload.logger.error('❌ STRIPE_WEBHOOKS_SIGNING_SECRET not configured')
      return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
    }

    // Verify webhook signature
    let event: Stripe.Event
    try {
      event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
    } catch (err) {
      const error = err as Error
      payload.logger.error(`❌ Webhook signature verification failed: ${error.message}`)
      return NextResponse.json({ error: `Webhook Error: ${error.message}` }, { status: 400 })
    }

    payload.logger.info(`✅ Webhook verified: ${event.type}`)
    payload.logger.info(`Event ID: ${event.id}`)

    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted({ event, payload, stripe })
        break

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated({ event, payload, stripe })
        break

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted({ event, payload, stripe })
        break

      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded({ event, payload, stripe })
        break

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed({ event, payload, stripe })
        break

      default:
        payload.logger.info(`Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    payload.logger.error('Error processing webhook:', error)
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    )
  }
}
