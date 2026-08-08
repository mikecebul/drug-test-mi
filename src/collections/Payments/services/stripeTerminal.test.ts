import type Stripe from 'stripe'
import type { Payload } from 'payload'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import type { Payment } from '@/payload-types'

const { applyAvailableClientCredit, applyIncomingPayment, getClientCreditBalance } = vi.hoisted(() => ({
  applyAvailableClientCredit: vi.fn(),
  applyIncomingPayment: vi.fn(),
  getClientCreditBalance: vi.fn(),
}))
const { stripeClient } = vi.hoisted(() => ({
  stripeClient: {
    paymentIntents: {
      cancel: vi.fn(),
      create: vi.fn(),
      retrieve: vi.fn(),
    },
    terminal: {
      locations: {
        list: vi.fn(),
      },
      readers: {
        cancelAction: vi.fn(),
        list: vi.fn(),
        processPaymentIntent: vi.fn(),
        retrieve: vi.fn(),
      },
    },
  },
}))

vi.mock('stripe', () => ({
  default: vi.fn(function StripeMock() {
    return stripeClient
  }),
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
  cancelGuidedTerminalPayment,
  findGuidedTerminalReader,
  markGuidedTerminalPaymentFailed,
  reconcileSucceededGuidedTerminalPayment,
  serializeGuidedTerminalPayment,
  startGuidedTerminalPayment,
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

  test('serializes a cancelled voided payment as cancelled instead of failed', () => {
    expect(
      serializeGuidedTerminalPayment(
        payment({
          status: 'voided',
          stripeTerminalStatus: 'cancelled',
          stripeTerminalFailureMessage: 'Terminal payment cancelled by the operator.',
        }),
      ),
    ).toMatchObject({
      failureMessage: 'Terminal payment cancelled by the operator.',
      status: 'cancelled',
    })
  })

  test('cancels the matching reader action and PaymentIntent before voiding the ledger payment', async () => {
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_terminal')
    stripeClient.terminal.readers.retrieve.mockResolvedValue({
      id: 'tmr_chx',
      label: 'Chx Desk',
      action: {
        status: 'in_progress',
        type: 'process_payment_intent',
        process_payment_intent: { payment_intent: 'pi_terminal' },
      },
    })
    stripeClient.terminal.readers.cancelAction.mockResolvedValue({ id: 'tmr_chx', action: null })
    stripeClient.paymentIntents.retrieve.mockResolvedValue({ id: 'pi_terminal', status: 'requires_payment_method' })
    stripeClient.paymentIntents.cancel.mockResolvedValue({ id: 'pi_terminal', status: 'canceled' })
    const update = vi.fn().mockResolvedValue(payment({ status: 'voided', stripeTerminalStatus: 'cancelled' }))
    const payload = {
      findByID: vi.fn().mockResolvedValue(payment()),
      update,
    } as unknown as Payload

    const result = await cancelGuidedTerminalPayment({ payload, paymentId: 'payment-1' })

    expect(result.success).toBe(true)
    expect(stripeClient.terminal.readers.cancelAction).toHaveBeenCalledWith('tmr_chx')
    expect(stripeClient.paymentIntents.cancel).toHaveBeenCalledWith('pi_terminal')
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'payments',
        id: 'payment-1',
        data: expect.objectContaining({ status: 'voided', stripeTerminalStatus: 'cancelled' }),
      }),
    )
  })

  test('clears an abandoned PaymentIntent when the physical reader reset removed its action', async () => {
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_terminal')
    stripeClient.terminal.readers.retrieve.mockResolvedValue({
      id: 'tmr_chx',
      label: 'Chx Desk',
      action: null,
    })
    stripeClient.paymentIntents.retrieve.mockResolvedValue({ id: 'pi_terminal', status: 'requires_payment_method' })
    stripeClient.paymentIntents.cancel.mockResolvedValue({ id: 'pi_terminal', status: 'canceled' })
    const payload = {
      findByID: vi.fn().mockResolvedValue(payment()),
      update: vi.fn().mockResolvedValue(payment({ status: 'voided', stripeTerminalStatus: 'cancelled' })),
    } as unknown as Payload

    const result = await cancelGuidedTerminalPayment({ payload, paymentId: 'payment-1' })

    expect(result.success).toBe(true)
    expect(stripeClient.terminal.readers.cancelAction).not.toHaveBeenCalled()
    expect(stripeClient.paymentIntents.cancel).toHaveBeenCalledWith('pi_terminal')
  })

  test('does not cancel an unrelated action that replaced the recorded payment on the reader', async () => {
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_terminal')
    stripeClient.terminal.readers.retrieve.mockResolvedValue({
      id: 'tmr_chx',
      label: 'Chx Desk',
      action: {
        status: 'in_progress',
        type: 'process_payment_intent',
        process_payment_intent: { payment_intent: 'pi_another_payment' },
      },
    })
    const payload = {
      findByID: vi.fn().mockResolvedValue(payment()),
      update: vi.fn(),
    } as unknown as Payload

    const result = await cancelGuidedTerminalPayment({ payload, paymentId: 'payment-1' })

    expect(result).toMatchObject({ success: false })
    expect(stripeClient.terminal.readers.cancelAction).not.toHaveBeenCalled()
    expect(stripeClient.paymentIntents.cancel).not.toHaveBeenCalled()
    expect(payload.update).not.toHaveBeenCalled()
  })

  test('cleans up a stale payment from a physical reader reset before starting a retry', async () => {
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_terminal')
    const stalePayment = payment({ relatedBooking: 'booking-from-previous-screen' })
    const retryPayment = payment({
      id: 'payment-2',
      stripePaymentIntentId: 'pi_retry',
      workflowOperationId: 'operation-retry',
    })
    stripeClient.terminal.readers.retrieve.mockResolvedValue({
      id: 'tmr_chx',
      label: 'Chx Desk',
      action: null,
    })
    stripeClient.paymentIntents.retrieve.mockResolvedValue({ id: 'pi_terminal', status: 'requires_payment_method' })
    stripeClient.paymentIntents.cancel.mockResolvedValue({ id: 'pi_terminal', status: 'canceled' })
    stripeClient.terminal.locations.list.mockReturnValue({
      autoPagingToArray: vi.fn().mockResolvedValue([{ id: 'tml_vault', display_name: 'The Vault' }]),
    })
    stripeClient.terminal.readers.list.mockReturnValue({
      autoPagingToArray: vi.fn().mockResolvedValue([{ id: 'tmr_chx', label: 'Chx Desk', location: 'tml_vault' }]),
    })
    stripeClient.paymentIntents.create.mockResolvedValue({ id: 'pi_retry', status: 'requires_payment_method' })
    stripeClient.terminal.readers.processPaymentIntent.mockResolvedValue({
      id: 'tmr_chx',
      action: { status: 'in_progress', type: 'process_payment_intent' },
    })
    const update = vi.fn().mockImplementation(({ id, data }: { id: string; data: Partial<Payment> }) => {
      if (id === 'payment-1') {
        return Promise.resolve(payment({ ...data, status: 'voided', stripeTerminalStatus: 'cancelled' }))
      }
      return Promise.resolve({ ...retryPayment, ...data })
    })
    const payload = {
      create: vi.fn().mockResolvedValue(retryPayment),
      find: vi
        .fn()
        .mockResolvedValueOnce({ docs: [] })
        .mockResolvedValueOnce({ docs: [stalePayment] }),
      findByID: vi.fn().mockResolvedValueOnce(stalePayment).mockResolvedValueOnce(retryPayment),
      update,
    } as unknown as Payload

    const result = await startGuidedTerminalPayment({
      amount: 50,
      bookingAmountDue: 50,
      bookingBalanceDue: 50,
      bookingId: 'booking-1',
      clientId: 'client-1',
      creditAmount: 0,
      operationId: 'operation-retry',
      payload,
      receiptEmail: 'client@example.com',
    })

    expect(result).toMatchObject({ success: true, payment: { id: 'payment-2', status: 'in-progress' } })
    expect(stripeClient.paymentIntents.cancel).toHaveBeenCalledWith('pi_terminal')
    expect(stripeClient.paymentIntents.create).toHaveBeenCalledOnce()
    expect(stripeClient.paymentIntents.cancel.mock.invocationCallOrder[0]).toBeLessThan(
      stripeClient.paymentIntents.create.mock.invocationCallOrder[0]!,
    )
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'payment-1',
        data: expect.objectContaining({ status: 'voided', stripeTerminalStatus: 'cancelled' }),
      }),
    )
    expect(payload.find).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          and: expect.arrayContaining([{ stripeTerminalReaderId: { equals: 'tmr_chx' } }]),
        }),
      }),
    )
  })

  test('keeps the payment recoverable when the reader request has an ambiguous network failure', async () => {
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_terminal')
    const pendingPayment = payment({ stripeTerminalStatus: 'pending' })
    stripeClient.terminal.locations.list.mockReturnValue({
      autoPagingToArray: vi.fn().mockResolvedValue([{ id: 'tml_vault', display_name: 'The Vault' }]),
    })
    stripeClient.terminal.readers.list.mockReturnValue({
      autoPagingToArray: vi.fn().mockResolvedValue([{ id: 'tmr_chx', label: 'Chx Desk', location: 'tml_vault' }]),
    })
    stripeClient.paymentIntents.create.mockResolvedValue({ id: 'pi_terminal', status: 'requires_payment_method' })
    stripeClient.paymentIntents.retrieve.mockResolvedValue({ id: 'pi_terminal', status: 'requires_payment_method' })
    stripeClient.terminal.readers.processPaymentIntent.mockRejectedValue(new Error('Connection reset'))
    const update = vi.fn().mockImplementation(({ data }: { data: Partial<Payment> }) =>
      Promise.resolve({ ...pendingPayment, ...data }),
    )
    const payload = {
      create: vi.fn().mockResolvedValue(pendingPayment),
      find: vi.fn().mockResolvedValue({ docs: [] }),
      update,
      logger: { warn: vi.fn() },
    } as unknown as Payload

    const result = await startGuidedTerminalPayment({
      amount: 50,
      bookingAmountDue: 50,
      bookingBalanceDue: 50,
      bookingId: 'booking-1',
      clientId: 'client-1',
      creditAmount: 0,
      operationId: 'operation-ambiguous',
      payload,
      receiptEmail: 'client@example.com',
    })

    expect(result).toMatchObject({ success: true, payment: { id: 'payment-1', status: 'in-progress' } })
    expect(stripeClient.paymentIntents.cancel).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'voided' }) }),
    )
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
      findByID: vi
        .fn()
        .mockImplementation(({ collection }: { collection: string }) =>
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

  test('repairs a payment that was falsely voided before Stripe reported success', async () => {
    const recoverablePayment = payment({
      status: 'voided',
      stripeTerminalStatus: 'failed',
      stripeTerminalFailureMessage: 'Connection reset',
      voidReason: 'Connection reset',
    })
    const booking = {
      id: 'booking-1',
      payment: { amountDue: 50, amountPaid: 0, status: 'unpaid' },
    }
    const update = vi.fn().mockImplementation(({ collection, data }: { collection: string; data: object }) =>
      Promise.resolve(collection === 'payments' ? { ...recoverablePayment, ...data } : { ...booking, ...data }),
    )
    const payload = {
      findByID: vi
        .fn()
        .mockImplementation(({ collection }: { collection: string }) =>
          Promise.resolve(collection === 'payments' ? recoverablePayment : booking),
        ),
      update,
      logger: { warn: vi.fn() },
    } as unknown as Payload
    getClientCreditBalance.mockResolvedValue(0)
    applyIncomingPayment.mockResolvedValue({ reservedForBookingAmount: 50 })

    await reconcileSucceededGuidedTerminalPayment({
      payload,
      paymentIntent: {
        id: 'pi_terminal',
        amount_received: 5000,
        metadata: { integration: 'guided-terminal', paymentId: 'payment-1' },
      } as unknown as Stripe.PaymentIntent,
    })

    expect(applyIncomingPayment).toHaveBeenCalledOnce()
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'payments',
        id: 'payment-1',
        data: expect.objectContaining({
          stripeTerminalStatus: 'succeeded',
          voidReason: null,
          voidedAt: null,
        }),
      }),
    )
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
