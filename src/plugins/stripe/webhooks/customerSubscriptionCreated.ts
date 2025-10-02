import type { StripeWebhookHandler } from '@payloadcms/plugin-stripe/types'
import type Stripe from 'stripe'

export const customerSubscriptionCreated: StripeWebhookHandler<{
  data: {
    object: Stripe.Subscription
  }
}> = async ({ event, payload, stripe }) => {
  const subscription = event.data.object

  payload.logger.info(`🪝 Processing subscription created for customer: ${subscription.customer}`)

  try {
    // Get customer details from Stripe to find the client
    const customer = await stripe.customers.retrieve(subscription.customer as string)

    if (customer.deleted) {
      payload.logger.error(`Customer ${subscription.customer} has been deleted`)
      return
    }

    // First try to find by existing stripeCustomerId
    let clientsResult = await payload.find({
      collection: 'clients',
      where: {
        'recurringAppointments.stripeCustomerId': {
          equals: subscription.customer,
        },
      },
      limit: 1,
    })

    // If not found by stripeCustomerId, try by email
    if (clientsResult.docs.length === 0 && customer.email) {
      payload.logger.info(
        `Client not found by stripeCustomerId, searching by email: ${customer.email}`,
      )
      clientsResult = await payload.find({
        collection: 'clients',
        where: {
          email: {
            equals: customer.email,
          },
        },
        limit: 1,
      })
    }

    if (clientsResult.docs.length === 0) {
      payload.logger.error(
        `No client found with Stripe customer ID: ${subscription.customer} or email: ${customer.email}`,
      )
      return
    }

    const client = clientsResult.docs[0]

    // Update client with subscription information
    const updateData: any = {
      isRecurring: true,
      stripeCustomerId: subscription.customer as string,
      stripeSubscriptionId: subscription.id,
      subscriptionStartDate: new Date(subscription.created * 1000).toISOString(),
    }

    // Only set status if it doesn't already exist (avoid overwriting status from subscription.updated webhook)
    if (!client.recurringAppointments?.subscriptionStatus) {
      updateData.subscriptionStatus = subscription.status
    }

    await payload.update({
      collection: 'clients',
      id: client.id,
      data: {
        recurringAppointments: updateData,
      },
    })

    payload.logger.info(`✅ Updated client ${client.id} with subscription ${subscription.id}`)
  } catch (error) {
    payload.logger.error(`Error processing subscription.created webhook: ${error}`)
    throw error
  }
}