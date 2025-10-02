import type { StripeWebhookHandler } from '@payloadcms/plugin-stripe/types'
import type Stripe from 'stripe'

export const customerSubscriptionUpdated: StripeWebhookHandler<{
  data: {
    object: Stripe.Subscription
  }
}> = async ({ event, payload }) => {
  const subscription = event.data.object

  payload.logger.info(`🪝 Processing subscription updated: ${subscription.id}`)

  try {
    // Find the client by Stripe subscription ID first
    let clientsResult = await payload.find({
      collection: 'clients',
      where: {
        'recurringAppointments.stripeSubscriptionId': {
          equals: subscription.id,
        },
      },
      limit: 1,
    })

    // If not found by subscription ID, try by customer ID (handles race condition)
    if (clientsResult.docs.length === 0) {
      payload.logger.info(
        `Client not found by subscription ID, trying by customer ID: ${subscription.customer}`,
      )
      clientsResult = await payload.find({
        collection: 'clients',
        where: {
          'recurringAppointments.stripeCustomerId': {
            equals: subscription.customer,
          },
        },
        limit: 1,
      })
    }

    if (clientsResult.docs.length === 0) {
      payload.logger.error(
        `No client found with subscription ID: ${subscription.id} or customer ID: ${subscription.customer}`,
      )
      return
    }

    const client = clientsResult.docs[0]

    // Update subscription status
    await payload.update({
      collection: 'clients',
      id: client.id,
      data: {
        recurringAppointments: {
          ...client.recurringAppointments,
          subscriptionStatus: subscription.status,
        },
      },
    })

    payload.logger.info(
      `✅ Updated client ${client.id} subscription status to: ${subscription.status}`,
    )
  } catch (error) {
    payload.logger.error(`Error processing subscription.updated webhook: ${error}`)
    throw error
  }
}
