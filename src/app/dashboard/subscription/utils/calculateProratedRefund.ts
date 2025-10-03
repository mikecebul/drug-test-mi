import type Stripe from 'stripe'

/**
 * Calculate prorated refund for subscription cancellation
 * @param stripe - Stripe instance
 * @param subscriptionId - Stripe subscription ID
 * @returns Refund amount in cents, days remaining, period end date, and latest charge ID
 */
export async function calculateProratedRefund(
  stripe: Stripe,
  subscriptionId: string,
): Promise<{
  refundAmount: number
  daysRemaining: number
  periodEnd: Date
  latestChargeId: string | null
}> {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId)

  const now = Math.floor(Date.now() / 1000)
  const periodEnd = subscription.current_period_end
  const periodStart = subscription.current_period_start

  // Calculate days
  const totalDays = (periodEnd - periodStart) / 86400 // seconds to days
  const daysRemaining = Math.max(0, (periodEnd - now) / 86400)

  // Get monthly price from subscription
  const monthlyPrice = subscription.items.data[0]?.price?.unit_amount || 0

  // Calculate prorated amount (round down to avoid over-refunding)
  const proratedAmount = Math.floor((monthlyPrice / totalDays) * daysRemaining)

  // Cap refund at 85% to cover Stripe processing fees and untracked usage
  const maxRefund = Math.floor(monthlyPrice * 0.85)
  const finalRefundAmount = Math.min(proratedAmount, maxRefund)

  // Get latest invoice to find charge ID
  let latestChargeId: string | null = null
  if (subscription.latest_invoice) {
    const invoice = await stripe.invoices.retrieve(subscription.latest_invoice as string)
    latestChargeId = invoice.charge as string | null
  }

  return {
    refundAmount: finalRefundAmount,
    daysRemaining: Math.ceil(daysRemaining),
    periodEnd: new Date(periodEnd * 1000),
    latestChargeId,
  }
}
