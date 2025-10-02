import type { StripeWebhookHandler } from '@payloadcms/plugin-stripe/types'
import type Stripe from 'stripe'

export const checkoutSessionCompleted: StripeWebhookHandler<{
  data: {
    object: Stripe.Checkout.Session
  }
}> = async ({ event, payload }) => {
  const { id: sessionId, metadata, mode } = event.data.object
  const submissionId = metadata?.submissionId

  payload.logger.info(`🪝 Processing checkout session completed for session ID: ${sessionId}`)

  // Subscription checkouts are handled by customer.subscription.created webhook
  if (mode === 'subscription') {
    payload.logger.info('Subscription checkout - handled by customer.subscription.created webhook')
    return
  }

  // Handle form submission checkout (one-time payments)
  if (!submissionId) {
    payload.logger.info('No submissionId in metadata, skipping form submission handling')
    return
  }
}
