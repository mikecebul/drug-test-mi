import Stripe from 'stripe'
import { closePendingClientCheckoutSessions } from '@/collections/Payments/services/closePendingClientCheckoutSessions'
import { randomUUID } from 'node:crypto'
import type { Payload, PayloadRequest } from 'payload'
import type { SubstanceValue } from '@/fields/substanceOptions'
import { allSubstanceOptions } from '@/fields/substanceOptions'
import {
  applyAvailableClientCredit,
  readRelationshipId,
  normalizeMoney,
} from '@/collections/Payments/services/applyPayment'
import { withPayloadTransaction } from '@/collections/Payments/services/withPayloadTransaction'
import { resolveBillingResponsibility } from '@/lib/referral-invoices/payer'
import { confirmationHoldUntil, knownScreeningDate, confirmationPaid, confirmationPrice } from './policy'

/** Prepare a decision without saving the uploaded report or claiming a lab order has been placed. */
export async function prepareConfirmation(input: {
  payload: Payload
  user: PayloadRequest['user']
  testId: string
  decision: 'accept' | 'pending-decision' | 'request-confirmation'
  substances: string[]
  screenedAt?: string
  bypassPaymentRequirement?: boolean
}) {
  if (!input.user || input.user.collection !== 'admins') throw new Error('Admin access required.')
  if (input.bypassPaymentRequirement && input.user.role !== 'superAdmin')
    throw new Error('Only the super admin can bypass confirmation payment.')
  const allowed = new Set(allSubstanceOptions.filter((s) => s.value !== 'none').map((s) => s.value))
  const substances = [...new Set(input.substances)].sort() as SubstanceValue[]
  if (input.decision === 'request-confirmation' && (!substances.length || substances.some((s) => !allowed.has(s))))
    throw new Error('Choose valid substances for confirmation.')
  // Close links before changing a request. Completed Stripe sessions must reconcile first.
  const before = await input.payload.findByID({
    collection: 'drug-tests',
    id: input.testId,
    depth: 0,
    overrideAccess: false,
    user: input.user,
  })
  const changed =
    before.confirmationRequestKey &&
    (before.confirmationDecision !== input.decision ||
      [...(before.confirmationSubstances || [])].sort().join(',') !== substances.join(','))
  if (changed) {
    if (confirmationPaid(before) > 0)
      throw new Error('Confirmation has a payment applied. Refund or undo it before changing the request.')
    const pending = await input.payload.find({
      collection: 'payments',
      where: {
        and: [
          { relatedDrugTest: { equals: input.testId } },
          { purpose: { equals: 'confirmation' } },
          { status: { equals: 'pending' } },
        ],
      },
      limit: 1,
      overrideAccess: true,
    })
    if (pending.docs.length) {
      if (!process.env.STRIPE_SECRET_KEY)
        throw new Error('Stripe must be configured to close the existing payment link.')
      await closePendingClientCheckoutSessions(
        input.payload,
        new Stripe(process.env.STRIPE_SECRET_KEY, {}),
        input.testId,
        'confirmation',
      )
    }
  }
  return withPayloadTransaction(
    input.payload,
    async (req) => {
      const test = await input.payload.findByID({
        collection: 'drug-tests',
        id: input.testId,
        depth: 0,
        overrideAccess: false,
        user: input.user,
        req,
      })
      if (test.isComplete || test.confirmationResults?.length)
        throw new Error('This test already has a final or confirmation result. Review it before changing the decision.')
      const clientId = readRelationshipId(test.relatedClient)
      if (!clientId) throw new Error('Client not found.')
      // New uploads supply the actual result date. Legacy tracker records must have a known result date.
      const screenedAt = knownScreeningDate(test) || input.screenedAt
      if (!screenedAt) throw new Error('Enter the screening result date before requesting confirmation.')
      if (new Date(screenedAt).getTime() > Date.now() + 60_000)
        throw new Error('The screening result date cannot be in the future.')
      const deadline = confirmationHoldUntil(screenedAt)
      if (
        input.decision === 'request-confirmation' &&
        new Date(deadline).getTime() <= Date.now() &&
        (!test.confirmationRequestKey ||
          test.confirmationDecision !== input.decision ||
          [...(test.confirmationSubstances || [])].sort().join(',') !== substances.join(','))
      )
        throw new Error('The 30-day laboratory hold has ended. Contact the lab before requesting confirmation.')
      const sameRequest =
        test.confirmationDecision === input.decision &&
        [...(test.confirmationSubstances || [])].sort().join(',') === substances.join(',')
      const previousFee = normalizeMoney(test.payment?.confirmationFeeDue)
      const feePaid = confirmationPaid(test)
      if (!sameRequest && feePaid > 0)
        throw new Error('Confirmation has a payment applied. Refund or undo it before changing the request.')
      let payer = await resolveBillingResponsibility(input.payload, test, clientId, req)
      if (!test.billingResponsibility?.payer && test.payment?.referralInvoice) {
        const invoice = await input.payload.findByID({
          collection: 'referral-invoices',
          id: readRelationshipId(test.payment.referralInvoice)!,
          depth: 0,
          overrideAccess: true,
          req,
        })
        const referralId = readRelationshipId(invoice.referral.value)
        if (!referralId) throw new Error('The original billing referral could not be identified.')
        payer = { payer: 'referral', referral: { relationTo: invoice.referral.relationTo, value: referralId } }
      }
      const fee = input.decision === 'request-confirmation' ? confirmationPrice(test.testType) * substances.length : 0
      const due = normalizeMoney(Math.max(0, (test.payment?.amountDue || 0) - previousFee + fee))
      const paid = normalizeMoney(test.payment?.amountPaid)
      let ownerId = readRelationshipId(test.confirmationNotificationAdmin)
      if (input.decision === 'request-confirmation' && !ownerId) {
        if (input.user?.collection === 'admins' && input.user.role === 'superAdmin') ownerId = input.user.id
        else {
          const owners = await input.payload.find({
            collection: 'admins',
            where: { role: { equals: 'superAdmin' } },
            sort: 'createdAt',
            limit: 1,
            depth: 0,
            overrideAccess: true,
            req,
          })
          ownerId = owners.docs[0]?.id || null
        }
        if (!ownerId) throw new Error('A super-admin account is required for confirmation payment notifications.')
      }
      const requestKey =
        input.decision === 'request-confirmation' ? (sameRequest && test.confirmationRequestKey) || randomUUID() : null
      const decisionContext = { ...req.context }
      const updated = await input.payload.update({
        collection: 'drug-tests',
        id: test.id,
        overrideAccess: true,
        req,
        data: {
          screenedAt,
          confirmationDecision: input.decision,
          confirmationSubstances: input.decision === 'request-confirmation' ? substances : [],
          confirmationRequestKey: requestKey,
          confirmationNotificationAdmin: ownerId,
          billingResponsibility: test.billingResponsibility?.payer ? test.billingResponsibility : payer,
          payment: {
            ...test.payment,
            amountDue: due,
            amountPaid: paid,
            balanceDue: Math.max(0, due - paid),
            referralInvoice: test.payment?.referralInvoice,
            status:
              payer.payer === 'referral' && test.payment?.status === 'invoiced'
                ? 'invoiced'
                : due <= paid
                  ? 'paid'
                  : paid > 0
                    ? 'partial'
                    : 'unpaid',
            confirmationFeeDue: fee,
            confirmationFeePaid: sameRequest ? feePaid : 0,
            confirmationPaymentBypassed: input.bypassPaymentRequirement === true,
            confirmationPaymentBypassedAt: input.bypassPaymentRequirement ? new Date().toISOString() : null,
          },
        },
      })
      // Nested balance hooks use context flags; they must not suppress the subsequent credit allocation's balance sync.
      req.context = decisionContext
      if (input.decision === 'request-confirmation' && payer.payer === 'client') {
        await applyAvailableClientCredit({
          payload: input.payload,
          clientId,
          relatedDrugTest: test.id,
          purpose: 'confirmation',
          confirmationRequestKey: requestKey!,
          amount: undefined,
          req,
        })
      }
      return updated
    },
    { requireTransaction: true, user: input.user },
  )
}
