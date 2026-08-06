import type { StripeWebhookHandler } from '@payloadcms/plugin-stripe/types'
import type Stripe from 'stripe'

import {
  GUIDED_TERMINAL_INTEGRATION,
  markGuidedTerminalPaymentFailed,
} from '@/collections/Payments/services/stripeTerminal'

export const paymentIntentPaymentFailed: StripeWebhookHandler<{
  data: {
    object: Stripe.PaymentIntent
  }
}> = async ({ event, payload }) => {
  const paymentIntent = event.data.object
  if (paymentIntent.metadata.integration !== GUIDED_TERMINAL_INTEGRATION) return

  await markGuidedTerminalPaymentFailed({
    failureMessage: paymentIntent.last_payment_error?.message,
    paymentIntentId: paymentIntent.id,
    payload,
  })
}
