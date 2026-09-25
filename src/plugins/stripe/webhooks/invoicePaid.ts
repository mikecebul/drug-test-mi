import type { StripeWebhookHandler } from '@payloadcms/plugin-stripe/types'
import type Stripe from 'stripe'
import { settleReferralInvoice } from '@/lib/referral-invoices/settle'

export const invoicePaid: StripeWebhookHandler<{ data: { object: Stripe.Invoice } }> = async ({ event, payload }) => {
  await settleReferralInvoice(payload, event.data.object)
}
