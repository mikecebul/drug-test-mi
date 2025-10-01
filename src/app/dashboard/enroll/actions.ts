'use server'

import { getPayload } from 'payload'
import config from '@payload-config'
import { requireClientAuth } from '@/utilities/auth/requireClientAuth'
import Stripe from 'stripe'
import { baseUrl } from '@/utilities/baseUrl'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-09-30.clover',
})

export async function initiateEnrollment(data: {
  productId: string
  testingType: string
  preferredDay?: string
  preferredTimeSlot?: string
}): Promise<string> {
  const client = await requireClientAuth()
  const payload = await getPayload({ config })

  // Get product details
  const product = await payload.findByID({
    collection: 'products',
    id: data.productId,
  })

  if (!product || !product.stripePriceId) {
    throw new Error('Invalid product or missing Stripe price')
  }

  // Get or create Stripe customer
  let stripeCustomerId = client.recurringAppointments?.stripeCustomerId

  if (!stripeCustomerId) {
    const stripeCustomer = await stripe.customers.create({
      email: client.email,
      name: `${client.firstName} ${client.lastName}`,
      metadata: {
        payloadClientId: client.id,
      },
    })
    stripeCustomerId = stripeCustomer.id

    // Update client with Stripe customer ID
    await payload.update({
      collection: 'clients',
      id: client.id,
      data: {
        recurringAppointments: {
          ...client.recurringAppointments,
          stripeCustomerId: stripeCustomer.id,
        },
      },
    })
  }

  // Create Stripe Checkout Session
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: stripeCustomerId,
    line_items: [
      {
        price: product.stripePriceId,
        quantity: 1,
      },
    ],
    success_url: `${baseUrl}/dashboard/enroll/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/dashboard/enroll/cancel`,
    metadata: {
      clientId: client.id,
      productId: product.id,
      testingType: data.testingType,
      preferredDay: data.preferredDay || '',
      preferredTimeSlot: data.preferredTimeSlot || '',
    },
    subscription_data: {
      metadata: {
        clientId: client.id,
        testingType: data.testingType,
      },
    },
  })

  if (!session.url) {
    throw new Error('Failed to create checkout session')
  }

  return session.url
}
