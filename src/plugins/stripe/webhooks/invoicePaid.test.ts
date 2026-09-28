import { expect, it, vi } from 'vitest'
import type { Payload } from 'payload'
import type Stripe from 'stripe'
import { invoicePaid } from './invoicePaid'
import { createAdminAlert } from '@/lib/admin-alerts'

vi.mock('@/collections/Payments/services/withPayloadTransaction', () => ({
  withPayloadTransaction: async (payload: Payload, operation: (req: object) => Promise<unknown>) =>
    operation({ payload }),
}))
vi.mock('@/lib/admin-alerts', () => ({ createAdminAlert: vi.fn() }))

it('posts the paid referral invoice to its exact test and flags later off-line payments for referral review', async () => {
  const invoice = {
    id: 'local-1',
    stripeInvoiceId: 'in_1',
    status: 'sent',
    items: [{ drugTest: 'test-1', client: 'client-1', amount: 20 }],
  }
  const findByID = vi.fn(async ({ collection }: { collection: string }) => {
    if (collection === 'referral-invoices') return invoice
    if (collection === 'drug-tests')
      return {
        id: 'test-1',
        payment: { amountDue: 40, amountPaid: 30, balanceDue: 10, status: 'partial' },
      }
    return { id: 'client-1', creditBalance: 3 }
  })
  const find = vi.fn().mockResolvedValue({ docs: [] })
  const update = vi.fn().mockResolvedValue({})
  const create = vi.fn().mockResolvedValue({})
  const payload = { findByID, find, update, create } as unknown as Payload
  const event = {
    data: {
      object: {
        id: 'in_1',
        status: 'paid',
        metadata: { referralInvoiceId: 'local-1' },
        created: 1780000000,
        status_transitions: { paid_at: 1780000100 },
      } as unknown as Stripe.Invoice,
    },
  }

  await invoicePaid({ event, payload } as Parameters<typeof invoicePaid>[0])
  expect(update).toHaveBeenCalledWith(
    expect.objectContaining({
      collection: 'drug-tests',
      data: { payment: expect.objectContaining({ amountPaid: 40, balanceDue: 0, status: 'paid' }) },
    }),
  )
  expect(update).not.toHaveBeenCalledWith(expect.objectContaining({ collection: 'clients' }))
  expect(create).toHaveBeenCalledWith(
    expect.objectContaining({
      collection: 'payments',
      data: expect.objectContaining({
        amount: 10,
        appliedAmount: 10,
        source: 'referral-invoice',
        stripeInvoiceId: 'in_1',
      }),
    }),
  )
  expect(update).toHaveBeenCalledWith(
    expect.objectContaining({
      collection: 'referral-invoices',
      data: expect.objectContaining({ status: 'paid', unappliedAmount: 10 }),
    }),
  )
  expect(createAdminAlert).toHaveBeenCalledWith(
    payload,
    expect.objectContaining({
      severity: 'high',
      context: expect.objectContaining({ unappliedAmount: 10 }),
    }),
  )
})

it('posts an out-of-band check as a check payment linked to its invoice', async () => {
  const payload = {
    findByID: vi.fn(async ({ collection }: { collection: string }) =>
      collection === 'referral-invoices'
        ? {
            id: 'local-check',
            stripeInvoiceId: 'in_check',
            status: 'sent',
            paymentMethod: 'check',
            checkReceivedAt: '2026-09-24T16:00:00.000Z',
            items: [{ drugTest: 'test-check', client: 'client-check', amount: 40 }],
          }
        : { id: 'test-check', payment: { amountDue: 40, amountPaid: 0, balanceDue: 40, status: 'invoiced' } },
    ),
    find: vi.fn().mockResolvedValue({ docs: [] }),
    update: vi.fn().mockResolvedValue({}),
    create: vi.fn().mockResolvedValue({}),
  } as unknown as Payload
  await invoicePaid({
    event: {
      data: {
        object: {
          id: 'in_check',
          status: 'paid',
          metadata: { referralInvoiceId: 'local-check' },
          created: 1780000000,
          status_transitions: { paid_at: 1780000100 },
        } as unknown as Stripe.Invoice,
      },
    },
    payload,
  } as Parameters<typeof invoicePaid>[0])
  expect(payload.create).toHaveBeenCalledWith(
    expect.objectContaining({
      collection: 'payments',
      data: expect.objectContaining({
        method: 'check',
        relatedReferralInvoice: 'local-check',
        collectedAt: '2026-09-24T16:00:00.000Z',
      }),
    }),
  )
  expect(payload.update).toHaveBeenCalledWith(
    expect.objectContaining({
      collection: 'drug-tests',
      data: { payment: expect.objectContaining({ status: 'paid', method: 'check', balanceDue: 0 }) },
    }),
  )
})
