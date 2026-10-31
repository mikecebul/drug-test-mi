import type { Payload } from 'payload'
import { describe, expect, test, vi } from 'vitest'

import { sendClientPaymentReceipt } from './clientReceipt'
import { sendCompletedTestReceipt } from './completedTestReceipt'

function fixture() {
  const booking = {
    id: 'booking-1',
    payment: { amountDue: 35, amountPaid: 0 },
    receiptEmailClaimedAt: null as string | null,
    unpaidReceiptRequested: true,
    sampleCollection: { status: 'pending', drugTest: 'test-1', collectedAt: '2026-10-31T15:00:00Z' },
  }
  const drugTest = {
    id: 'test-1',
    relatedClient: 'client-1',
    testType: '17-panel-instant',
    collectionDate: '2026-10-31T15:00:00Z',
    payment: { amountPaid: 0, balanceDue: 35 },
  }
  const client = {
    id: 'client-1',
    firstName: 'Jordan',
    lastName: 'Smith',
    email: 'client@example.test',
    disableClientEmails: false,
    creditBalance: 0,
    referral: null as { relationTo: string; value: string } | null,
  }
  let paymentReceived = false
  let historicalReceipt = false
  const sendEmail = vi.fn().mockResolvedValue({})
  const updateOne = vi.fn().mockImplementation(async ({ data }) => {
    if (booking.receiptEmailClaimedAt) return null
    booking.receiptEmailClaimedAt = data.receiptEmailClaimedAt
    return { ...booking }
  })
  const payload = {
    findByID: vi.fn().mockImplementation(async ({ collection }) => {
      if (collection === 'bookings') return booking
      if (collection === 'drug-tests') return drugTest
      if (collection === 'clients') return client
      return { id: 'referral-1', isBillable: true }
    }),
    find: vi.fn().mockImplementation(async ({ where }) => ({
      // The receipt history query has an OR of email-delivery conditions;
      // the completion query asks whether any money/credit was received.
      docs: (where.and.some((condition: { or?: unknown }) => condition.or) ? historicalReceipt : paymentReceived)
        ? [{ id: 'payment-1' }]
        : [],
    })),
    db: { updateOne },
    email: { defaultFromAddress: 'info@example.test' },
    sendEmail,
    logger: { warn: vi.fn() },
  } as unknown as Payload
  const paidReceipt = () =>
    sendClientPaymentReceipt({
      payload,
      bookingId: booking.id,
      receiptEmail: client.email,
      data: {
        appliedToPreviousBalances: 0,
        appliedToToday: 35,
        cashReceived: 35,
        clientCreditApplied: 0,
        clientCreditBalance: 0,
        clientName: 'Jordan Smith',
        collectedAt: drugTest.collectionDate,
        creditAdded: 0,
        paymentMethod: 'Cash',
        receiptType: 'paid-in-full',
        remainingBalance: 0,
        testName: '17-Panel Instant',
      },
    })
  return {
    payload,
    booking,
    drugTest,
    client,
    sendEmail,
    updateOne,
    paidReceipt,
    receivePayment: () => {
      paymentReceived = true
    },
    receiveHistoricalReceipt: () => {
      historicalReceipt = true
    },
  }
}

describe('one receipt per test visit', () => {
  test('sends no unpaid email while payment steps are revisited; sends once on completion', async () => {
    const f = fixture()
    await sendCompletedTestReceipt(f.payload, f.booking.id)
    await sendCompletedTestReceipt(f.payload, f.booking.id)
    expect(f.sendEmail).not.toHaveBeenCalled()

    f.booking.sampleCollection.status = 'collected'
    await sendCompletedTestReceipt(f.payload, f.booking.id)
    await sendCompletedTestReceipt(f.payload, f.booking.id)
    expect(f.sendEmail).toHaveBeenCalledTimes(1)
    expect(f.sendEmail.mock.calls[0][0].html).toContain('No payment received')
    expect(f.sendEmail.mock.calls[0][0].html).toContain('$35.00 remains due for your test.')
  })

  test('emails cash immediately and does not resend after revisiting payment or completing', async () => {
    const f = fixture()
    expect(await f.paidReceipt()).not.toBeNull()
    expect(f.sendEmail).toHaveBeenCalledTimes(1)
    expect(f.sendEmail.mock.calls[0][0].html).toContain('Payment received in full')
    expect(await f.paidReceipt()).toBeNull()
    f.booking.sampleCollection.status = 'collected'
    await sendCompletedTestReceipt(f.payload, f.booking.id)
    expect(f.sendEmail).toHaveBeenCalledTimes(1)
  })

  test('an atomic claim prevents concurrent receipt requests from sending twice', async () => {
    const f = fixture()
    await Promise.all([f.paidReceipt(), f.paidReceipt()])
    expect(f.sendEmail).toHaveBeenCalledTimes(1)
    expect(f.updateOne.mock.calls[0][0]).toMatchObject({
      collection: 'bookings',
      where: { and: [{ id: { equals: f.booking.id } }, { receiptEmailClaimedAt: { exists: false } }] },
    })
  })

  test('recognizes an earlier cash or Stripe receipt even without a booking claim', async () => {
    const f = fixture()
    f.receiveHistoricalReceipt()
    expect(await f.paidReceipt()).toBeNull()
    f.booking.sampleCollection.status = 'collected'
    await sendCompletedTestReceipt(f.payload, f.booking.id)
    expect(f.sendEmail).not.toHaveBeenCalled()
  })

  test.each(['partial', 'paid'])('does not send an unpaid notice for a %s test', async (status) => {
    const f = fixture()
    f.booking.sampleCollection.status = 'collected'
    f.drugTest.payment.amountPaid = status === 'partial' ? 10 : 35
    f.drugTest.payment.balanceDue = 35 - f.drugTest.payment.amountPaid
    await sendCompletedTestReceipt(f.payload, f.booking.id)
    expect(f.sendEmail).not.toHaveBeenCalled()
  })

  test('does not claim no payment when the payment covered older balances', async () => {
    const f = fixture()
    f.booking.sampleCollection.status = 'collected'
    f.receivePayment()
    await sendCompletedTestReceipt(f.payload, f.booking.id)
    expect(f.sendEmail).not.toHaveBeenCalled()
  })

  test.each(['disabled', 'missing', 'referral', 'opt-out'])(
    'respects the %s client email restriction',
    async (restriction) => {
      const f = fixture()
      f.booking.sampleCollection.status = 'collected'
      if (restriction === 'disabled') f.client.disableClientEmails = true
      if (restriction === 'missing') f.client.email = ''
      if (restriction === 'referral') f.client.referral = { relationTo: 'courts', value: 'referral-1' }
      if (restriction === 'opt-out') f.booking.unpaidReceiptRequested = false
      await sendCompletedTestReceipt(f.payload, f.booking.id)
      expect(f.sendEmail).not.toHaveBeenCalled()
      expect(f.updateOne).not.toHaveBeenCalled()
    },
  )

  test('delivery failure does not fail a completed test or automatically send another receipt', async () => {
    const f = fixture()
    f.booking.sampleCollection.status = 'collected'
    f.sendEmail.mockRejectedValueOnce(new Error('Mail unavailable'))
    await expect(sendCompletedTestReceipt(f.payload, f.booking.id)).resolves.toBeUndefined()
    await sendCompletedTestReceipt(f.payload, f.booking.id)
    expect(f.sendEmail).toHaveBeenCalledTimes(1)
    expect(f.payload.logger.warn).toHaveBeenCalled()
  })
})
