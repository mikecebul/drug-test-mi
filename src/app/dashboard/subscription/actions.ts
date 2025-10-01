'use server'

import { getPayload } from 'payload'
import config from '@payload-config'
import { requireClientAuth } from '@/utilities/auth/requireClientAuth'
import Stripe from 'stripe'
import { baseUrl } from '@/utilities/baseUrl'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-09-30.clover',
})

/**
 * Creates a Stripe Customer Portal session for managing subscription
 */
export async function manageSubscription(): Promise<string> {
  const client = await requireClientAuth()

  if (!client.recurringAppointments?.stripeCustomerId) {
    throw new Error('No Stripe customer ID found')
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: client.recurringAppointments.stripeCustomerId,
    return_url: `${baseUrl}/dashboard/subscription`,
  })

  return session.url
}

/**
 * Cancels a subscription at period end
 */
export async function cancelSubscription(subscriptionId: string): Promise<void> {
  const client = await requireClientAuth()
  const payload = await getPayload({ config })

  // Cancel the subscription in Stripe
  await stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: true,
  })

  // Update the enrollment status
  const enrollmentResult = await payload.find({
    collection: 'orders',
    where: {
      and: [
        {
          customer: {
            equals: client.id,
          },
        },
        {
          stripeSubscriptionId: {
            equals: subscriptionId,
          },
        },
      ],
    },
    limit: 1,
  })

  if (enrollmentResult.docs[0]) {
    await payload.update({
      collection: 'orders',
      id: enrollmentResult.docs[0].id,
      data: {
        subscriptionStatus: 'canceled',
      },
    })
  }
}
