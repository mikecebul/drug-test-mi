import type { Payload } from 'payload'
import type Stripe from 'stripe'
import { withPayloadTransaction } from '@/collections/Payments/services/withPayloadTransaction'
import { createAdminAlert } from '@/lib/admin-alerts'
import type { DrugTest } from '@/payload-types'

function idOf(value: unknown): string | null {
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (value && typeof value === 'object' && 'id' in value) return idOf(value.id)
  return null
}

function cents(value: number) {
  return Math.round(value * 100)
}

/** Both the Stripe webhook and the check action use this idempotent ledger posting. */
export async function settleReferralInvoice(payload: Payload, stripeInvoice: Stripe.Invoice) {
  const referralInvoiceId = stripeInvoice.metadata?.referralInvoiceId
  if (!referralInvoiceId || stripeInvoice.status !== 'paid') return

  const unappliedCents = await withPayloadTransaction(payload, async (req) => {
    const invoice = await payload.findByID({ collection: 'referral-invoices', id: referralInvoiceId, depth: 0, req })
    if (invoice.stripeInvoiceId !== stripeInvoice.id)
      throw new Error('Stripe invoice ID does not match the referral invoice.')
    if (invoice.status === 'paid') return 0

    const method = invoice.paymentMethod === 'check' ? 'check' : 'stripe'
    const paidAt = new Date((stripeInvoice.status_transitions?.paid_at || stripeInvoice.created) * 1000).toISOString()
    const collectedAt = method === 'check' ? invoice.checkReceivedAt || paidAt : paidAt
    let unappliedCents = 0

    for (const item of invoice.items || []) {
      const testId = idOf(item.drugTest)
      const clientId = idOf(item.client)
      if (!testId || !clientId) throw new Error('Referral invoice has an invalid test or client reference.')
      const existing = await payload.find({
        collection: 'payments',
        where: { and: [{ stripeInvoiceId: { equals: stripeInvoice.id } }, { relatedDrugTest: { equals: testId } }] },
        limit: 1,
        depth: 0,
        req,
      })
      if (existing.docs.length) continue

      const test = (await payload.findByID({ collection: 'drug-tests', id: testId, depth: 0, req })) as DrugTest
      const chargedCents = cents(item.amount)
      const balanceCents = cents(test.payment?.balanceDue || 0)
      const appliedCents = Math.min(chargedCents, balanceCents)
      unappliedCents += chargedCents - appliedCents
      const dueCents = cents(test.payment?.amountDue || 0)
      const paidCents = Math.min(dueCents, cents(test.payment?.amountPaid || 0) + appliedCents)
      const remainingCents = Math.max(0, dueCents - paidCents)

      if (appliedCents) {
        await payload.update({
          collection: 'drug-tests',
          id: testId,
          req,
          data: {
            payment: {
              ...test.payment,
              amountPaid: paidCents / 100,
              balanceDue: remainingCents / 100,
              status: remainingCents === 0 ? 'paid' : 'partial',
              method,
              lastPaymentAt: paidAt,
              referralInvoice: invoice.id,
            },
          },
        })
        await payload.create({
          collection: 'payments',
          req,
          data: {
            relatedClient: clientId,
            relatedDrugTest: testId,
            relatedReferralInvoice: invoice.id,
            amount: appliedCents / 100,
            appliedAmount: appliedCents / 100,
            allocations: [{ drugTest: testId, amount: appliedCents / 100 }],
            method,
            source: 'referral-invoice',
            status: 'posted',
            stripeInvoiceId: stripeInvoice.id,
            collectedAt,
            postedAt: new Date().toISOString(),
          },
        })
      }
    }
    await payload.update({
      collection: 'referral-invoices',
      id: invoice.id,
      req,
      data: { status: 'paid', paymentMethod: method, unappliedAmount: unappliedCents / 100, paidAt },
    })
    return unappliedCents
  })
  if (unappliedCents > 0) {
    await createAdminAlert(payload, {
      severity: 'high',
      alertType: 'data-integrity',
      title: `Referral invoice ${stripeInvoice.id} has an overpayment`,
      message: `The referral paid $${(unappliedCents / 100).toFixed(2)} after some drug-test balances were paid elsewhere. Review the invoice for a refund or credit. No client credit was created.`,
      context: { referralInvoiceId, stripeInvoiceId: stripeInvoice.id, unappliedAmount: unappliedCents / 100 },
    })
  }
}
