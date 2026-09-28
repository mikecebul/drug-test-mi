import type { StripeWebhookHandler } from '@payloadcms/plugin-stripe/types'
import type Stripe from 'stripe'

export const checkoutSessionAsyncPaymentFailed: StripeWebhookHandler<{
  data: { object: Stripe.Checkout.Session }
}> = async ({ event, payload }) => {
  const session = event.data.object
  const paymentId = session.metadata?.paymentId
  if (!paymentId) return

  const payment = await payload.findByID({
    collection: 'payments',
    id: paymentId,
    depth: 0,
    overrideAccess: true,
  })
  if (payment.status !== 'pending' || payment.stripeCheckoutSessionId !== session.id) return

  await payload.update({
    collection: 'payments',
    id: paymentId,
    data: { status: 'voided', voidedAt: new Date().toISOString() },
    overrideAccess: true,
  })
}
