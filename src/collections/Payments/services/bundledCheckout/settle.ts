import type { DrugTest, Payment } from '@/payload-types'
import type { Payload } from 'payload'
import type Stripe from 'stripe'
import { getTestTypeByValue } from '@/config/test-types'
import { isClientBilledToReferral } from '@/lib/referral-invoices/payer'
import { syncClientMoneyOwed } from '@/collections/DrugTests/hooks/syncClientBalance'
import {
  getConfirmationSubstances,
  getOutstandingConfirmations,
  LAB_CONFIRMATION_FEE,
} from '@/collections/DrugTests/helpers/confirmationPayment'
import { readRelationshipId } from '../applyPayment'
import { withPayloadTransaction } from '../withPayloadTransaction'
import { getChargeBalance, isReferralInvoiced, toCents, type BundledCharge } from './charges'

export function getBundleExpiry(payment: Pick<Payment, 'createdAt'>) {
  // Keep expiry within the provider's 24-hour idempotency window.
  return Math.floor(new Date(payment.createdAt).getTime() / 1000) + 23 * 60 * 60
}

export async function voidBundledCheckout(payload: Payload, paymentId: string) {
  await payload.update({
    collection: 'payments',
    where: { id: { equals: paymentId }, status: { equals: 'pending' } },
    data: { status: 'voided', voidReason: 'Stripe checkout expired' },
    depth: 0,
  })
}

function allocationForCharge(test: DrugTest, charge: BundledCharge) {
  const { screen, confirmation, fee, due, paid } = getChargeBalance(test)
  const cents = charge.amountCents
  if (charge.kind === 'screen') return { applied: Math.min(screen, cents), addedFee: 0 }
  if (screen > 0) return { applied: 0, addedFee: 0 }

  if (charge.kind === 'confirmation' || fee === cents) {
    return { applied: Math.min(confirmation, cents), addedFee: 0 }
  }
  if (fee === 0 && due > 0 && due === paid) return { applied: cents, addedFee: cents }
  return { applied: 0, addedFee: 0 }
}

function shouldAdvanceConfirmation(test: DrugTest, confirmationFee: number, balanceDue: number) {
  if (
    balanceDue !== 0 || test.screeningStatus !== 'screened' || test.isComplete || test.isInconclusive ||
    test.confirmationDocument || test.confirmationDecision !== 'request-confirmation' ||
    getTestTypeByValue(test.testType)?.category !== 'lab'
  ) return false

  const selected = getConfirmationSubstances(test.confirmationSubstances)
  return confirmationFee >= LAB_CONFIRMATION_FEE * selected.length &&
    getOutstandingConfirmations(selected, test.confirmationResults).length > 0
}

export async function settleBundledCheckout(payload: Payload, session: Stripe.Checkout.Session, eventTime?: number) {
  const paymentId = session.metadata?.bundledPaymentId
  if (!paymentId || session.payment_status !== 'paid') return

  const intent = session.payment_intent
  const intentId = readRelationshipId(intent)
  const charge = intent && typeof intent !== 'string' ? intent.latest_charge : null
  const chargeTime = charge && typeof charge !== 'string' ? charge.created : undefined
  const paidAt = new Date((chargeTime ?? eventTime ?? Date.now() / 1000) * 1000).toISOString()

  await withPayloadTransaction(payload, async (req) => {
    if (!req.transactionID) throw new Error('Bundled checkout requires MongoDB transactions.')
    const payment = await payload.findByID({ collection: 'payments', id: paymentId, depth: 0, req })
    const bundle = payment.bundledCheckout
    const charges = bundle?.charges
    const clientId = readRelationshipId(payment.relatedClient)
    if (
      !bundle?.requestId || !charges?.length || !clientId || !intentId ||
      payment.stripeCheckoutSessionId !== session.id || session.metadata?.clientId !== clientId ||
      session.mode !== 'payment' || session.status !== 'complete' || session.currency !== 'usd' ||
      session.amount_total !== toCents(payment.amount) ||
      session.amount_total !== charges.reduce((total, charge) => total + charge.amountCents, 0)
    ) {
      throw new Error('Stripe session does not match the stored payment request.')
    }
    if (payment.status !== 'pending') return

    const testIds = charges.map((charge) => readRelationshipId(charge.drugTest))
    const referralBilled = await isClientBilledToReferral(payload, clientId, req)
    const tests = await payload.find({
      collection: 'drug-tests',
      where: { id: { in: testIds }, relatedClient: { equals: clientId } },
      depth: 0,
      limit: charges.length,
      req,
    })
    const allocations: NonNullable<Payment['allocations']> = []
    let appliedCents = 0
    for (const item of charges) {
      const test = tests.docs.find(({ id }) => id === readRelationshipId(item.drugTest))
      if (!test || referralBilled || isReferralInvoiced(test)) continue

      const { applied, addedFee } = allocationForCharge(test, item)
      if (applied <= 0) continue

      const { due, paid, fee } = getChargeBalance(test)
      const balanceDue = (due + addedFee - paid - applied) / 100
      const confirmationFeeDue = (fee + addedFee) / 100
      await payload.update({
        collection: 'drug-tests',
        id: test.id,
        data: {
          ...(shouldAdvanceConfirmation(test, confirmationFeeDue, balanceDue)
            ? { screeningStatus: 'confirmation-pending' }
            : {}),
          payment: {
            ...test.payment,
            amountDue: (due + addedFee) / 100,
            confirmationFeeDue,
            amountPaid: (paid + applied) / 100,
            balanceDue,
            status: balanceDue ? 'partial' : 'paid',
            method: 'stripe',
            lastPaymentAt: paidAt,
          },
        },
        context: { skipTestResultComputation: true, skipClientBalanceSync: true },
        req,
      })
      allocations.push({ drugTest: test.id, amount: applied / 100 })
      appliedCents += applied
    }
    if (appliedCents > 0) await syncClientMoneyOwed(req, clientId)

    const unappliedCents = session.amount_total - appliedCents
    await payload.update({
      collection: 'payments',
      id: payment.id,
      data: {
        status: 'posted',
        stripePaymentIntentId: intentId,
        collectedAt: paidAt,
        appliedAmount: appliedCents / 100,
        allocations,
        bundledCheckout: { unappliedAmount: unappliedCents / 100 },
      },
      req,
    })
    if (unappliedCents > 0) {
      await payload.create({
        collection: 'admin-alerts',
        data: {
          severity: 'high',
          alertType: 'data-integrity',
          title: 'Bundled client payment needs reconciliation',
          message: `$${(unappliedCents / 100).toFixed(2)} could not be applied to the selected charges. Review the Stripe payment for a refund.`,
          resolved: false,
          context: { paymentId, stripeCheckoutSessionId: session.id },
        },
        req,
      })
    }
  })
}

export async function reconcileBundledCheckout(payload: Payload, stripe: Stripe, payment: Payment) {
  if (payment.status !== 'pending' || !payment.bundledCheckout?.requestId) return
  if (!payment.stripeCheckoutSessionId) {
    if (getBundleExpiry(payment) <= Date.now() / 1000) await voidBundledCheckout(payload, payment.id)
    return
  }

  const session = await stripe.checkout.sessions.retrieve(payment.stripeCheckoutSessionId, {
    expand: ['payment_intent.latest_charge'],
  })
  if (session.payment_status === 'paid') await settleBundledCheckout(payload, session)
  else if (session.status === 'expired') await voidBundledCheckout(payload, payment.id)
}

export async function syncBundledCheckouts(payload: Payload, stripe: Stripe) {
  let checked = 0
  let failures = 0
  let lastId: string | undefined
  while (true) {
    const { docs } = await payload.find({
      collection: 'payments',
      where: {
        status: { equals: 'pending' },
        'bundledCheckout.requestId': { exists: true },
        ...(lastId ? { id: { greater_than: lastId } } : {}),
      },
      sort: 'id',
      depth: 0,
      limit: 100,
    })
    if (!docs.length) break
    for (const payment of docs) {
      checked++
      try {
        await reconcileBundledCheckout(payload, stripe, payment)
      } catch (err) {
        failures++
        payload.logger.error({ msg: `Could not reconcile bundled checkout ${payment.id}`, err })
      }
    }
    lastId = docs[docs.length - 1].id
  }
  if (failures) throw new Error(`Could not reconcile ${failures} bundled checkouts.`)
  return { checked }
}
