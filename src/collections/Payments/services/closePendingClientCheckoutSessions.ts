import type { Payload } from 'payload'
import type Stripe from 'stripe'

export async function closePendingClientCheckoutSessions(payload: Payload, stripe: Stripe, testId: string) {
  const pending = await payload.find({
    collection: 'payments',
    where: {
      and: [
        { relatedDrugTest: { equals: testId } },
        { source: { equals: 'stripe-checkout' } },
        { status: { equals: 'pending' } },
      ],
    },
    depth: 0,
    limit: 100,
    overrideAccess: true,
  })
  if (pending.hasNextPage) throw new Error('Too many pending payment links exist for this test. Contact an administrator.')

  for (const payment of pending.docs) {
    if (!payment.stripeCheckoutSessionId)
      throw new Error('A payment link is still being created for this test. Try again shortly.')
    const session = await stripe.checkout.sessions.retrieve(payment.stripeCheckoutSessionId)
    if (session.status === 'complete')
      throw new Error('A checkout payment is still processing or awaiting reconciliation for this test.')
    if (session.status === 'open') await stripe.checkout.sessions.expire(session.id)
    else if (session.status !== 'expired')
      throw new Error('Stripe could not confirm that the previous payment link is closed.')
    await payload.update({
      collection: 'payments',
      id: payment.id,
      data: { status: 'voided', voidedAt: new Date().toISOString() },
      overrideAccess: true,
    })
  }
}
