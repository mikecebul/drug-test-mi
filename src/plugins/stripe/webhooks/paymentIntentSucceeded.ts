import type { StripeWebhookHandler } from '@payloadcms/plugin-stripe/types'
import type Stripe from 'stripe'

import { reconcileSucceededGuidedTerminalPayment } from '@/collections/Payments/services/stripeTerminal'

export const paymentIntentSucceeded: StripeWebhookHandler<{
  data: {
    object: Stripe.PaymentIntent
  }
}> = async ({ event, payload }) => {
  const reconciled = await reconcileSucceededGuidedTerminalPayment({
    paymentIntent: event.data.object,
    payload,
  })

  if (reconciled) {
    const { revalidateBookingViews } = await import('@/utilities/revalidateBookingViews')
    revalidateBookingViews()
  }
}
