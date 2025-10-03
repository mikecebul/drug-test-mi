'use server'

import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { headers } from 'next/headers'
import Stripe from 'stripe'
import { revalidatePath } from 'next/cache'
import { baseUrl } from '@/utilities/baseUrl'

import { calculateProratedRefund } from './utils/calculateProratedRefund'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2022-08-01',
})

export async function createCheckoutSessionAction(priceId: string) {
  const payload = await getPayload({ config: configPromise })

  try {
    const { user } = await payload.auth({ headers: await headers() })

    if (!user || user.collection !== 'clients') {
      return { success: false, error: 'Unauthorized' }
    }

    // Get or create Stripe customer
    let customerId = user.recurringAppointments?.stripeCustomerId

    if (!customerId) {
      // Create new Stripe customer
      const customer = await stripe.customers.create({
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        metadata: {
          payloadClientId: user.id,
        },
      })

      customerId = customer.id

      // Update client with Stripe customer ID
      await payload.update({
        collection: 'clients',
        id: user.id,
        data: {
          recurringAppointments: {
            ...user.recurringAppointments,
            stripeCustomerId: customerId,
          },
        },
        overrideAccess: true,
      })
    }

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/dashboard/subscription?success=true`,
      cancel_url: `${baseUrl}/dashboard/subscription?canceled=true`,
      metadata: {
        payloadClientId: user.id,
      },
    })

    return { success: true, url: session.url }
  } catch (error) {
    console.error('Error creating checkout session:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create checkout session',
    }
  }
}

export async function cancelSubscriptionAction() {
  const payload = await getPayload({ config: configPromise })

  try {
    const { user } = await payload.auth({ headers: await headers() })

    if (!user || user.collection !== 'clients') {
      return { success: false, error: 'Unauthorized' }
    }

    const subscriptionId = user.recurringAppointments?.stripeSubscriptionId

    if (!subscriptionId) {
      return { success: false, error: 'No active subscription found' }
    }

    // Calculate prorated refund
    const { refundAmount, daysRemaining, latestChargeId } = await calculateProratedRefund(
      stripe,
      subscriptionId,
    )

    // Issue refund if there's money to refund and a charge exists
    let refundIssued = false
    if (refundAmount > 0 && latestChargeId) {
      await stripe.refunds.create({
        charge: latestChargeId,
        amount: refundAmount,
        reason: 'requested_by_customer',
        metadata: {
          type: 'prorated_cancellation',
          days_remaining: daysRemaining.toString(),
          client_id: user.id,
        },
      })
      refundIssued = true
    }

    // Cancel subscription immediately
    await stripe.subscriptions.cancel(subscriptionId)

    // Revalidate the subscription page
    revalidatePath('/dashboard/subscription')

    const message = refundIssued
      ? `Subscription canceled. A refund of $${(refundAmount / 100).toFixed(2)} for ${daysRemaining} unused ${daysRemaining === 1 ? 'day' : 'days'} will be processed to your payment method within 5-10 business days.`
      : 'Subscription canceled successfully'

    return {
      success: true,
      message,
      refundAmount: refundIssued ? refundAmount : 0,
    }
  } catch (error) {
    console.error('Error canceling subscription:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to cancel subscription',
    }
  }
}
