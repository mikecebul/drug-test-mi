import type { Payload } from 'payload'

import { getTestTypeByValue } from '@/config/test-types'
import { isClientBilledToReferral } from '@/lib/referral-invoices/payer'
import { resolveClientReceiptEmail, sendClientPaymentReceipt } from './clientReceipt'

/** Called after the collection workflow saves its completed booking. */
export async function sendCompletedTestReceipt(payload: Payload, bookingId: string) {
  try {
    const booking = await payload.findByID({
      collection: 'bookings',
      id: bookingId,
      depth: 0,
      overrideAccess: true,
    })
    if (booking.sampleCollection?.status !== 'collected' || !booking.sampleCollection.drugTest) return
    if (
      !booking.unpaidReceiptRequested ||
      booking.receiptEmailClaimedAt ||
      (booking.payment?.amountPaid ?? 0) > 0 ||
      booking.payment?.status === 'paid' ||
      booking.payment?.method === 'pre-paid'
    )
      return

    const testId =
      typeof booking.sampleCollection.drugTest === 'string'
        ? booking.sampleCollection.drugTest
        : booking.sampleCollection.drugTest.id
    const test = await payload.findByID({
      collection: 'drug-tests',
      id: testId,
      depth: 0,
      overrideAccess: true,
    })
    if ((test.payment?.amountPaid ?? 0) > 0 || !(test.payment?.balanceDue && test.payment.balanceDue > 0)) return
    const clientId = typeof test.relatedClient === 'string' ? test.relatedClient : test.relatedClient.id
    if (await isClientBilledToReferral(payload, clientId)) return
    const client = await payload.findByID({
      collection: 'clients',
      id: clientId,
      depth: 0,
      overrideAccess: true,
    })
    const receiptEmail = resolveClientReceiptEmail(client)
    if (!receiptEmail) return

    // A payment can cover older balances while leaving today's test unpaid.
    // Do not describe that visit as having received no payment.
    const payments = await payload.find({
      collection: 'payments',
      where: {
        and: [
          { relatedBooking: { equals: bookingId } },
          { status: { in: ['posted', 'refunded'] } },
          { amount: { greater_than: 0 } },
        ],
      },
      depth: 0,
      limit: 1,
      overrideAccess: true,
    })
    if (payments.docs.length) return

    await sendClientPaymentReceipt({
      payload,
      bookingId,
      receiptEmail,
      data: {
        appliedToPreviousBalances: 0,
        appliedToToday: 0,
        cashReceived: 0,
        clientCreditApplied: 0,
        clientCreditBalance: client.creditBalance ?? 0,
        clientName: [client.firstName, client.lastName].filter(Boolean).join(' ') || client.email,
        collectedAt: booking.sampleCollection.collectedAt || test.collectionDate || new Date().toISOString(),
        creditAdded: 0,
        paymentMethod: 'Not paid',
        receiptType: 'unpaid',
        remainingBalance: test.payment.balanceDue,
        testName: getTestTypeByValue(test.testType)?.label || 'Drug test',
      },
    })
  } catch (error) {
    // Email delivery must not undo a saved collection or prompt a duplicate test.
    payload.logger.warn({ msg: `Completed test receipt could not be sent for booking ${bookingId}`, err: error })
  }
}
