import type { StripeWebhookHandler } from '@payloadcms/plugin-stripe/types'
import type Stripe from 'stripe'

export const customerSubscriptionDeleted: StripeWebhookHandler<{
  data: {
    object: Stripe.Subscription
  }
}> = async ({ event, payload }) => {
  const subscription = event.data.object

  payload.logger.info(`🪝 Processing subscription deleted: ${subscription.id}`)

  try {
    // Find the client by Stripe subscription ID
    const clientsResult = await payload.find({
      collection: 'clients',
      where: {
        'recurringAppointments.stripeSubscriptionId': {
          equals: subscription.id,
        },
      },
      limit: 1,
    })

    if (clientsResult.docs.length === 0) {
      payload.logger.error(`No client found with subscription ID: ${subscription.id}`)
      return
    }

    const client = clientsResult.docs[0]

    // Update client to reflect canceled subscription
    await payload.update({
      collection: 'clients',
      id: client.id,
      data: {
        recurringAppointments: {
          ...client.recurringAppointments,
          isRecurring: false,
          subscriptionStatus: 'canceled',
        },
      },
    })

    payload.logger.info(`✅ Canceled subscription for client ${client.id}`)
  } catch (error) {
    payload.logger.error(`Error processing subscription.deleted webhook: ${error}`)
    throw error
  }
}
