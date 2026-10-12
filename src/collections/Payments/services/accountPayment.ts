import type { Payload, PayloadRequest } from 'payload'
import { applyIncomingPayment, normalizeMoney } from './applyPayment'
import { withPayloadTransaction } from './withPayloadTransaction'
import { classifyPaymentReceipt, resolveClientReceiptEmail, sendClientPaymentReceipt } from './clientReceipt'
import { clientBalances } from './clientBalances'
import { payerRelationshipId } from '@/lib/referral-invoices/payer'

export class AccountPaymentRejection extends Error {}

export async function postAccountPayment(input: {
  payload: Payload
  user: PayloadRequest['user']
  clientId: string
  amount: number
  operationId: string
  sendReceipt?: boolean
}) {
  if (input.user?.collection !== 'admins') throw new AccountPaymentRejection('Admin access required.')
  const cents = Math.round(input.amount * 100)
  if (
    !Number.isFinite(input.amount) ||
    cents <= 0 ||
    !Number.isSafeInteger(cents) ||
    Math.abs(input.amount * 100 - cents) > 0.00001
  )
    throw new AccountPaymentRejection('Enter a positive amount with no more than two decimal places.')
  if (!input.operationId?.trim() || input.operationId.length < 8 || input.operationId.length > 200)
    throw new AccountPaymentRejection('A payment operation ID is required.')
  const posted = await withPayloadTransaction(
    input.payload,
    async (req) => {
      // Establish the MongoDB transaction with one command before paginated reads (count + documents).
      const client = await input.payload.findByID({
        collection: 'clients',
        id: input.clientId,
        depth: 0,
        req,
        overrideAccess: false,
      })
      const existing = await input.payload.find({
        collection: 'payments',
        where: { accountOperationId: { equals: input.operationId } },
        limit: 1,
        depth: 0,
        req,
        overrideAccess: false,
      })
      if (existing.docs[0]) {
        const payment = existing.docs[0]
        if (
          payerRelationshipId(payment.relatedClient) !== input.clientId ||
          normalizeMoney(payment.amount) !== input.amount
        )
          throw new AccountPaymentRejection('This payment request belongs to another client or amount.')
        if (payment.status !== 'posted')
          throw new Error('This payment is still being processed. Check payment history before trying again.')
        return { payment, receipt: null }
      }
      const before = await clientBalances(input.payload, input.clientId, req)
      const initialCredit = normalizeMoney(client.creditBalance)
      // Claim the unique operation before changing any balances. Every write shares the same transaction.
      const claim = await input.payload.create({
        collection: 'payments',
        data: {
          relatedClient: client.id,
          amount: input.amount,
          method: 'cash',
          source: 'manual',
          status: 'pending',
          accountOperationId: input.operationId,
          collectedBy: input.user?.id,
        },
        depth: 0,
        req,
        overrideAccess: true,
      })
      const payment = await applyIncomingPayment({
        payload: input.payload,
        clientId: client.id,
        amount: input.amount,
        method: 'cash',
        source: 'manual',
        allocationOrder: 'oldest-balance-first',
        existingPaymentId: claim.id,
        req,
      })
      const remainingBalance = normalizeMoney(Math.max(0, before.clientBalance - (payment.appliedAmount || 0)))
      const creditAdded = normalizeMoney(payment.creditAmount)
      const receiptEmail = input.sendReceipt ? resolveClientReceiptEmail(client) : null
      return {
        payment,
        receipt: receiptEmail
          ? {
              email: receiptEmail,
              data: {
                clientName: [client.firstName, client.middleInitial, client.lastName].filter(Boolean).join(' '),
                collectedAt: payment.collectedAt || new Date().toISOString(),
                cashReceived: input.amount,
                clientCreditApplied: 0,
                clientCreditBalance: normalizeMoney(initialCredit + creditAdded),
                creditAdded,
                appliedToPreviousBalances: payment.appliedAmount || 0,
                appliedToToday: 0,
                remainingBalance,
                paymentMethod: 'Cash',
                testName: 'Account payment',
                receiptType: classifyPaymentReceipt({ creditAdded, remainingBalance }),
              },
            }
          : null,
      }
    },
    { requireTransaction: true, user: input.user },
  )
  let receipt: { sent: boolean; error?: string } | null = null
  if (posted.receipt) {
    try {
      await sendClientPaymentReceipt({
        payload: input.payload,
        receiptEmail: posted.receipt.email,
        data: posted.receipt.data,
      })
      receipt = { sent: true }
      await input.payload
        .update({
          collection: 'payments',
          id: posted.payment.id,
          data: {
            receiptEmail: posted.receipt.email,
            receiptEmailSentAt: new Date().toISOString(),
            receiptType: posted.receipt.data.receiptType,
          },
          overrideAccess: true,
        })
        .catch((error) =>
          input.payload.logger.error({
            err: error,
            msg: 'Account payment receipt sent but delivery metadata could not be saved.',
          }),
        )
    } catch (error) {
      receipt = { sent: false, error: error instanceof Error ? error.message : 'Receipt could not be sent.' }
    }
  }
  return {
    success: true as const,
    paymentId: posted.payment.id,
    amount: posted.payment.amount,
    appliedAmount: posted.payment.appliedAmount || 0,
    creditAdded: posted.payment.creditAmount || 0,
    receipt,
  }
}
