import type Stripe from 'stripe'
import type { Order } from '@/payload-types'
import type { Payload } from 'payload'
import { APIError } from 'payload'

type WebhookHandler = {
  event: Stripe.Event
  payload: Payload
  stripe: Stripe
}

/**
 * Map Stripe subscription status to our supported statuses
 */
const mapSubscriptionStatus = (
  stripeStatus: Stripe.Subscription.Status,
  collection: 'clients' | 'orders',
): string => {
  // Common statuses
  if (['active', 'past_due', 'canceled', 'incomplete'].includes(stripeStatus)) {
    return stripeStatus
  }

  // Client-specific: unpaid
  if (collection === 'clients' && stripeStatus === 'unpaid') {
    return 'unpaid'
  }

  // Order-specific: paused (Stripe added this status later, may not be in all type versions)
  if (collection === 'orders' && stripeStatus === ('paused' as any)) {
    return 'paused'
  }

  // Map incomplete_expired and trialing to incomplete
  if (stripeStatus === 'incomplete_expired' || stripeStatus === 'trialing') {
    return 'incomplete'
  }

  // Map unpaid to canceled for orders (orders don't support unpaid status)
  if (collection === 'orders' && stripeStatus === 'unpaid') {
    return 'canceled'
  }

  // Default to incomplete for unknown statuses
  return 'incomplete'
}

/**
 * Handle checkout.session.completed for subscription checkouts
 * This creates the enrollment when a subscription checkout is completed
 */
export const handleCheckoutSessionCompleted = async ({
  event,
  payload,
  stripe,
}: WebhookHandler) => {
  const session = event.data.object as Stripe.Checkout.Session

  payload.logger.info(`🪝 Processing subscription checkout completed for session: ${session.id}`)
  payload.logger.info(`Session metadata:`, session.metadata)

  // Only handle subscription mode checkouts
  if (session.mode !== 'subscription') {
    payload.logger.info('Skipping non-subscription checkout session')
    return
  }

  if (!session.subscription) {
    throw new APIError('No subscription ID found in checkout session')
  }

  try {
    // Retrieve the subscription
    const subscription = await stripe.subscriptions.retrieve(session.subscription as string)
    payload.logger.info(`Retrieved subscription: ${subscription.id}`)

    // Get the product from metadata
    const productId = session.metadata?.productId

    if (!productId) {
      payload.logger.error('Missing productId in metadata:', session.metadata)
      throw new APIError('No productId found in session metadata')
    }

    // Get client ID from metadata
    const clientId = session.metadata?.clientId

    if (!clientId) {
      payload.logger.error('Missing clientId in metadata:', session.metadata)
      throw new APIError('No clientId found in session metadata')
    }

    payload.logger.info(`Creating enrollment for client: ${clientId}, product: ${productId}`)

    // Create the enrollment (order)
    const enrollment = await payload.create({
      collection: 'orders',
      data: {
        customer: clientId,
        customerEmail: session.customer_email || undefined,
        items: [
          {
            product: productId,
            quantity: 1,
          },
        ],
        amount: subscription.items.data[0].plan.amount || 0,
        currency: 'USD' as const,
        status: 'processing',
        stripeSubscriptionId: subscription.id,
        subscriptionStatus: mapSubscriptionStatus(subscription.status, 'orders') as Order['subscriptionStatus'],
        testingType: (session.metadata?.testingType || 'random-1x') as Order['testingType'],
        preferredDayOfWeek: (session.metadata?.preferredDay || null) as Order['preferredDayOfWeek'],
        preferredTimeSlot: (session.metadata?.preferredTimeSlot || null) as Order['preferredTimeSlot'],
      },
    })

    // Update the client record with subscription info
    const client = await payload.findByID({
      collection: 'clients',
      id: clientId,
    })

    await payload.update({
      collection: 'clients',
      id: clientId,
      data: {
        recurringAppointments: {
          ...client.recurringAppointments,
          isRecurring: true,
          stripeSubscriptionId: subscription.id,
          subscriptionStatus: mapSubscriptionStatus(subscription.status, 'clients') as 'active' | 'past_due' | 'canceled' | 'unpaid' | 'incomplete',
          subscriptionStartDate: new Date().toISOString(),
        },
      },
    })

    payload.logger.info(`✅ Created enrollment ${enrollment.id} for subscription ${subscription.id}`)
  } catch (error) {
    payload.logger.error('Error handling checkout.session.completed:', error)
    throw error
  }
}

/**
 * Handle customer.subscription.updated
 * Updates enrollment status when subscription status changes
 */
export const handleSubscriptionUpdated = async ({ event, payload }: WebhookHandler) => {
  const subscription = event.data.object as Stripe.Subscription

  payload.logger.info(`🪝 Processing subscription updated: ${subscription.id}`)

  try {
    // Find the enrollment with this subscription ID
    const enrollments = await payload.find({
      collection: 'orders',
      where: {
        stripeSubscriptionId: {
          equals: subscription.id,
        },
      },
      limit: 1,
    })

    if (enrollments.docs.length === 0) {
      payload.logger.warn(`No enrollment found for subscription ${subscription.id}`)
      return
    }

    const enrollment = enrollments.docs[0]

    // Update enrollment status
    await payload.update({
      collection: 'orders',
      id: enrollment.id,
      data: {
        subscriptionStatus: mapSubscriptionStatus(subscription.status, 'orders') as Order['subscriptionStatus'],
        status:
          subscription.status === 'active'
            ? 'processing'
            : subscription.status === 'canceled'
              ? 'cancelled'
              : enrollment.status,
      },
    })

    // Update client record if exists
    if (enrollment.customer) {
      const clientId = typeof enrollment.customer === 'string' ? enrollment.customer : enrollment.customer.id
      const client = await payload.findByID({
        collection: 'clients',
        id: clientId,
      })

      await payload.update({
        collection: 'clients',
        id: clientId,
        data: {
          recurringAppointments: {
            ...client.recurringAppointments,
            subscriptionStatus: mapSubscriptionStatus(subscription.status, 'clients') as 'active' | 'past_due' | 'canceled' | 'unpaid' | 'incomplete',
          },
        },
      })
    }

    payload.logger.info(`✅ Updated enrollment ${enrollment.id} status to ${subscription.status}`)
  } catch (error) {
    payload.logger.error('Error handling customer.subscription.updated:', error)
    throw error
  }
}

/**
 * Handle customer.subscription.deleted
 * Marks enrollment as cancelled when subscription is deleted
 */
export const handleSubscriptionDeleted = async ({ event, payload }: WebhookHandler) => {
  const subscription = event.data.object as Stripe.Subscription

  payload.logger.info(`🪝 Processing subscription deleted: ${subscription.id}`)

  try {
    // Find the enrollment with this subscription ID
    const enrollments = await payload.find({
      collection: 'orders',
      where: {
        stripeSubscriptionId: {
          equals: subscription.id,
        },
      },
      limit: 1,
    })

    if (enrollments.docs.length === 0) {
      payload.logger.warn(`No enrollment found for subscription ${subscription.id}`)
      return
    }

    const enrollment = enrollments.docs[0]

    // Update enrollment to cancelled
    await payload.update({
      collection: 'orders',
      id: enrollment.id,
      data: {
        subscriptionStatus: 'canceled',
        status: 'cancelled',
      },
    })

    // Update client record if exists
    if (enrollment.customer) {
      const clientId = typeof enrollment.customer === 'string' ? enrollment.customer : enrollment.customer.id
      const client = await payload.findByID({
        collection: 'clients',
        id: clientId,
      })

      await payload.update({
        collection: 'clients',
        id: clientId,
        data: {
          recurringAppointments: {
            ...client.recurringAppointments,
            isRecurring: false,
            subscriptionStatus: 'canceled' as const,
          },
        },
      })
    }

    payload.logger.info(`✅ Cancelled enrollment ${enrollment.id}`)
  } catch (error) {
    payload.logger.error('Error handling customer.subscription.deleted:', error)
    throw error
  }
}

/**
 * Handle invoice.payment_succeeded
 * Creates a transaction record for each successful subscription payment
 */
export const handleInvoicePaymentSucceeded = async ({ event, payload }: WebhookHandler) => {
  const invoice = event.data.object as Stripe.Invoice

  payload.logger.info(`🪝 Processing invoice payment succeeded: ${invoice.id}`)

  // Only process for subscriptions
  if (!invoice.subscription) {
    payload.logger.info('Skipping non-subscription invoice')
    return
  }

  try {
    // Find the enrollment with this subscription ID
    const enrollments = await payload.find({
      collection: 'orders',
      where: {
        stripeSubscriptionId: {
          equals: invoice.subscription as string,
        },
      },
      limit: 1,
    })

    if (enrollments.docs.length === 0) {
      payload.logger.warn(`No enrollment found for subscription ${invoice.subscription}`)
      return
    }

    const enrollment = enrollments.docs[0]

    // Create transaction record
    const transaction = await payload.create({
      collection: 'transactions',
      data: {
        customer: enrollment.customer,
        amount: invoice.amount_paid,
        currency: 'USD' as const,
        status: 'succeeded',
        paymentMethod: 'stripe-checkout-subscription',
        'stripe-checkout-subscription': {
          subscriptionId: invoice.subscription as string,
          customerId: invoice.customer as string,
        },
        subscriptionPeriod: {
          periodStart: invoice.period_start ? new Date(invoice.period_start * 1000).toISOString() : null,
          periodEnd: invoice.period_end ? new Date(invoice.period_end * 1000).toISOString() : null,
        },
      },
    })

    payload.logger.info(`✅ Created transaction ${transaction.id} for invoice ${invoice.id}`)
  } catch (error) {
    payload.logger.error('Error handling invoice.payment_succeeded:', error)
    throw error
  }
}

/**
 * Handle invoice.payment_failed
 * Updates enrollment status when payment fails
 */
export const handleInvoicePaymentFailed = async ({ event, payload }: WebhookHandler) => {
  const invoice = event.data.object as Stripe.Invoice

  payload.logger.info(`🪝 Processing invoice payment failed: ${invoice.id}`)

  // Only process for subscriptions
  if (!invoice.subscription) {
    payload.logger.info('Skipping non-subscription invoice')
    return
  }

  try {
    // Find the enrollment with this subscription ID
    const enrollments = await payload.find({
      collection: 'orders',
      where: {
        stripeSubscriptionId: {
          equals: invoice.subscription as string,
        },
      },
      limit: 1,
    })

    if (enrollments.docs.length === 0) {
      payload.logger.warn(`No enrollment found for subscription ${invoice.subscription}`)
      return
    }

    const enrollment = enrollments.docs[0]

    // Update enrollment status to past_due
    await payload.update({
      collection: 'orders',
      id: enrollment.id,
      data: {
        subscriptionStatus: 'past_due',
      },
    })

    // Update client record if exists
    if (enrollment.customer) {
      const clientId = typeof enrollment.customer === 'string' ? enrollment.customer : enrollment.customer.id
      const client = await payload.findByID({
        collection: 'clients',
        id: clientId,
      })

      await payload.update({
        collection: 'clients',
        id: clientId,
        data: {
          recurringAppointments: {
            ...client.recurringAppointments,
            subscriptionStatus: 'past_due' as 'active' | 'past_due' | 'canceled' | 'unpaid' | 'incomplete',
          },
        },
      })
    }

    payload.logger.info(`✅ Updated enrollment ${enrollment.id} to past_due status`)
  } catch (error) {
    payload.logger.error('Error handling invoice.payment_failed:', error)
    throw error
  }
}
