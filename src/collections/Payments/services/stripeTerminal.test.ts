import type Stripe from 'stripe'
import type { Payload } from 'payload'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import type { Payment } from '@/payload-types'

const { applyAvailableClientCredit, applyIncomingPayment, getClientCreditBalance } = vi.hoisted(() => ({
  applyAvailableClientCredit: vi.fn(),
  applyIncomingPayment: vi.fn(),
  getClientCreditBalance: vi.fn(),
}))

vi.mock('./applyPayment', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./applyPayment')>()
  return {
    ...actual,
    applyAvailableClientCredit,
    applyIncomingPayment,
    getClientCreditBalance,
  }
})

vi.mock('./withPayloadTransaction', () => ({
  withPayloadTransaction: async (_payload: Payload, operation: (req: object) => Promise<unknown>) => operation({}),
}))

import {
  buildGuidedTerminalPaymentIntentParams,
  findGuidedTerminalReader,
  markGuidedTerminalPaymentFailed,
  reconcileSucceededGuidedTerminalPayment,
  serializeGuidedTerminalPayment,
} from './stripeTerminal'
import { resolveClientReceiptEmail } from './clientReceipt'

function payment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: 'payment-1',
    amount: 50,
    method: 'stripe',
    source: 'guided-workflow',
    status: 'pending',
    relatedClient: 'client-1',
    relatedBooking: 'booking-1',
    stripePaymentIntentId: 'pi_terminal',
    stripeTerminalReaderId: 'tmr_chx',
    stripeTerminalReaderLabel: 'Chx Desk',
    stripeTerminalStatus: 'in-progress',
    receiptEmail: 'client@example.com',
    pendingCreditAmount: 0,
    pendingBookingAmountDue: 50,
    pendingBookingBalanceDue: 50,
    workflowOperationId: 'operation-123',
    updatedAt: '2026-08-06T10:00:00.000Z',
    createdAt: '2026-08-06T10:00:00.000Z',
    ...overrides,
  }
}

describe('Stripe Terminal payment service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
  })

  test('resolves The Vault and Chx Desk by their configured names', async () => {
    const locationPaging = vi.fn().mockResolvedValue([
      { id: 'tml_other', display_name: 'Other Location' },
      { id: 'tml_vault', display_name: 'The Vault' },
    ])
    const readerPaging = vi.fn().mockResolvedValue([
      { id: 'tmr_other', label: 'Other Desk', location: 'tml_vault' },
      { id: 'tmr_chx', label: 'Chx Desk', location: 'tml_vault' },
    ])
    const stripe = {
      terminal: {
        locations: {
          list: vi.fn().mockReturnValue({ autoPagingToArray: locationPaging }),
        },
        readers: {
          list: vi.fn().mockReturnValue({ autoPagingToArray: readerPaging }),
        },
      },
    } as unknown as Stripe

    const result = await findGuidedTerminalReader(stripe)

    expect(result.location.id).toBe('tml_vault')
    expect(result.reader.id).toBe('tmr_chx')
    expect(stripe.terminal.readers.list).toHaveBeenCalledWith({ location: 'tml_vault', limit: 100 })
  })

  test('builds a card-present PaymentIntent that emails the linked client receipt', () => {
    const params = buildGuidedTerminalPaymentIntentParams({
      amount: 42.5,
      bookingId: 'booking-1',
      clientId: 'client-1',
      operationId: 'operation-123',
      paymentId: 'payment-1',
      receiptEmail: 'client@example.com',
    })

    expect(params).toMatchObject({
      amount: 4250,
      capture_method: 'automatic',
      currency: 'usd',
      payment_method_types: ['card_present'],
      receipt_email: 'client@example.com',
      metadata: {
        integration: 'guided-terminal',
        paymentId: 'payment-1',
        bookingId: 'booking-1',
        clientId: 'client-1',
        workflowOperationId: 'operation-123',
      },
    })
    expect(JSON.stringify(params.metadata)).not.toContain('client@example.com')
  })

  test('does not ask Stripe to email a receipt when client emails are disabled', () => {
    const params = buildGuidedTerminalPaymentIntentParams({
      amount: 42.5,
      bookingId: 'booking-1',
      clientId: 'client-1',
      operationId: 'operation-123',
      paymentId: 'payment-1',
      receiptEmail: null,
    })

    expect(params).not.toHaveProperty('receipt_email')
  })

  test('does not use a required filler email when client emails are disabled', () => {
    expect(
      resolveClientReceiptEmail({
        disableClientEmails: true,
        email: 'no-email.client@example.com',
      }),
    ).toBeNull()
  })

  test('serializes a posted payment as succeeded even if an earlier in-progress update arrives late', () => {
    expect(serializeGuidedTerminalPayment(payment({ status: 'posted' }))).toEqual({
      amount: 50,
      failureMessage: null,
      id: 'payment-1',
      readerLabel: 'Chx Desk',
      receiptEmail: 'client@example.com',
      status: 'succeeded',
    })
  })

  test('posts and allocates only the exact succeeded Terminal PaymentIntent', async () => {
    const pendingPayment = payment()
    const booking = {
      id: 'booking-1',
      payment: {
        amountDue: 50,
        amountPaid: 0,
        status: 'unpaid',
      },
    }
    const update = vi.fn().mockImplementation(({ collection, data }: { collection: string; data: object }) => {
      if (collection === 'payments') return Promise.resolve({ ...pendingPayment, ...data })
      return Promise.resolve({ ...booking, ...data })
    })
    const payload = {
      findByID: vi.fn().mockImplementation(({ collection }: { collection: string }) =>
        Promise.resolve(collection === 'payments' ? pendingPayment : booking),
      ),
      update,
      logger: { warn: vi.fn() },
    } as unknown as Payload
    getClientCreditBalance.mockResolvedValue(0)
    applyIncomingPayment.mockResolvedValue({ reservedForBookingAmount: 50 })

    const reconciled = await reconcileSucceededGuidedTerminalPayment({
      payload,
      paymentIntent: {
        id: 'pi_terminal',
        amount_received: 5000,
        metadata: {
          integration: 'guided-terminal',
          paymentId: 'payment-1',
        },
      } as unknown as Stripe.PaymentIntent,
    })

    expect(reconciled).toBe(true)
    expect(applyIncomingPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 50,
        clientId: 'client-1',
        existingPaymentId: 'payment-1',
        method: 'stripe',
        relatedBooking: 'booking-1',
        source: 'guided-workflow',
        stripePaymentIntentId: 'pi_terminal',
      }),
    )
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'bookings',
        id: 'booking-1',
        data: expect.objectContaining({
          payment: expect.objectContaining({
            amountPaid: 50,
            method: 'card',
            status: 'paid',
          }),
        }),
      }),
    )
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'payments',
        id: 'payment-1',
        data: expect.objectContaining({ stripeTerminalStatus: 'succeeded' }),
      }),
    )
  })

  test('does not allocate a duplicate succeeded webhook after the payment is posted', async () => {
    const payload = {
      findByID: vi.fn().mockResolvedValue(payment({ status: 'posted', stripeTerminalStatus: 'succeeded' })),
      logger: { warn: vi.fn() },
    } as unknown as Payload

    await reconcileSucceededGuidedTerminalPayment({
      payload,
      paymentIntent: {
        id: 'pi_terminal',
        amount_received: 5000,
        metadata: {
          integration: 'guided-terminal',
          paymentId: 'payment-1',
        },
      } as unknown as Stripe.PaymentIntent,
    })

    expect(applyIncomingPayment).not.toHaveBeenCalled()
  })

  test('voids a pending ledger entry when Stripe reports a failed PaymentIntent', async () => {
    const update = vi.fn().mockResolvedValue(payment({ status: 'voided', stripeTerminalStatus: 'failed' }))
    const payload = {
      find: vi.fn().mockResolvedValue({ docs: [payment()] }),
      update,
    } as unknown as Payload

    const handled = await markGuidedTerminalPaymentFailed({
      failureMessage: 'Card declined.',
      paymentIntentId: 'pi_terminal',
      payload,
    })

    expect(handled).toBe(true)
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'payments',
        id: 'payment-1',
        data: expect.objectContaining({
          status: 'voided',
          stripeTerminalFailureMessage: 'Card declined.',
          stripeTerminalStatus: 'failed',
        }),
      }),
    )
  })
})
