import { describe, expect, it, vi } from 'vitest'
import type { Payload } from 'payload'
import type Stripe from 'stripe'
import { billingPeriodEnd, collectionDateInDetroit, previousBillingMonth } from './referral-invoices/date'
import { previewReferralInvoice, sendReferralInvoice } from './referral-invoices'

function mockPayload(priorInvoice?: Record<string, unknown>) {
  let invoice: Record<string, unknown> | null = priorInvoice || null
  const find = vi.fn(
    async ({ collection, where }: { collection: string; where?: { billingKey?: { equals: string } } }) => {
      if (collection === 'clients')
        return { docs: [{ id: 'client-1', firstName: 'Jane', lastName: 'Doe' }], hasNextPage: false }
      if (collection === 'drug-tests')
        return {
          docs: [
            {
              id: 'test-1',
              relatedClient: 'client-1',
              collectionDate: '2026-08-12T14:00:00.000Z',
              testType: '11-panel-lab',
              payment: { balanceDue: 20 },
            },
            {
              id: 'test-2',
              relatedClient: 'client-1',
              collectionDate: '2026-08-15T14:00:00.000Z',
              testType: '17-panel-instant',
              payment: { balanceDue: 35 },
            },
          ],
          hasNextPage: false,
        }
      if (collection === 'referral-invoices')
        return {
          docs: invoice && (!where?.billingKey || where.billingKey.equals === invoice.billingKey) ? [invoice] : [],
          hasNextPage: false,
        }
      return { docs: [], hasNextPage: false }
    },
  )
  const findByID = vi.fn(async () => ({
    id: 'court-1',
    name: 'North Court',
    isBillable: true,
    billingEmail: 'billing@court.test',
  }))
  const create = vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
    invoice = { ...data, id: 'invoice-1' }
    return invoice
  })
  const update = vi.fn(async ({ collection, data }: { collection: string; data: Record<string, unknown> }) => {
    if (collection === 'referral-invoices') invoice = { ...invoice, ...data }
    return collection === 'referral-invoices' ? invoice : { id: 'court-1', ...data }
  })
  return {
    payload: { find, findByID, create, update, logger: { error: vi.fn() } } as unknown as Payload,
    find,
    create,
    update,
  }
}

describe('monthly referral invoicing', () => {
  it('uses the completed Detroit billing month and DST aware cutoff', () => {
    expect(previousBillingMonth(new Date('2026-09-01T01:00:00Z'))).toBe('2026-07')
    expect(previousBillingMonth(new Date('2026-09-01T14:00:00Z'))).toBe('2026-08')
    expect(billingPeriodEnd('2026-08', new Date('2026-09-24T12:00:00Z'))).toBe('2026-09-01T04:00:00.000Z')
    expect(billingPeriodEnd('2026-11', new Date('2026-12-02T12:00:00Z'))).toBe('2026-12-01T05:00:00.000Z')
    expect(collectionDateInDetroit('2026-08-12T02:00:00.000Z')).toBe('2026-08-11')
  })

  it('previews remaining balances for clients at the selected referral', async () => {
    const { payload, find } = mockPayload()
    const preview = await previewReferralInvoice(payload, 'courts', 'court-1', '2026-08')
    expect(preview.amount).toBe(55)
    expect(preview.items.map((item) => [item.clientName, item.amount])).toEqual([
      ['Jane Doe', 20],
      ['Jane Doe', 35],
    ])
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'drug-tests',
        where: {
          and: [
            { relatedClient: { in: ['client-1'] } },
            { 'payment.balanceDue': { greater_than: 0 } },
            { collectionDate: { less_than: '2026-09-01T04:00:00.000Z' } },
          ],
        },
      }),
    )
  })

  it('does not invoice a test that was already billed before its client changed referrals', async () => {
    const { payload } = mockPayload({
      billingKey: 'employers:old:2026-07',
      status: 'sent',
      items: [{ drugTest: 'test-1' }],
    })
    const preview = await previewReferralInvoice(payload, 'courts', 'court-1', '2026-08')
    expect(preview.items.map((item) => item.drugTest)).toEqual(['test-2'])
    expect(preview.amount).toBe(35)
  })

  it('creates, itemizes, and sends one Stripe invoice, then leaves it sent on a repeat request', async () => {
    const { payload, create, update } = mockPayload()
    const stripe = {
      customers: { create: vi.fn().mockResolvedValue({ id: 'cus_1' }), update: vi.fn() },
      invoices: {
        create: vi.fn().mockResolvedValue({ id: 'in_1', status: 'draft' }),
        retrieve: vi.fn(),
        finalizeInvoice: vi.fn().mockResolvedValue({ id: 'in_1', status: 'open' }),
        sendInvoice: vi
          .fn()
          .mockResolvedValue({ id: 'in_1', status: 'open', hosted_invoice_url: 'https://invoice.test/1' }),
      },
      invoiceItems: { create: vi.fn().mockResolvedValue({ id: 'ii_1' }) },
    }
    const result = await sendReferralInvoice(payload, 'courts', 'court-1', '2026-08', stripe as unknown as Stripe)
    expect(result.status).toBe('sent')
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'referral-invoices', data: expect.objectContaining({ amount: 55 }) }),
    )
    expect(stripe.invoices.create).toHaveBeenCalledWith(
      expect.objectContaining({
        collection_method: 'send_invoice',
        auto_advance: false,
        description: expect.stringContaining('Jane Doe — 2026-08-12'),
      }),
      expect.anything(),
    )
    expect(stripe.invoiceItems.create).toHaveBeenCalledTimes(2)
    expect(stripe.invoiceItems.create).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 2000, description: '11-Panel Lab — Jane Doe (2026-08-12)' }),
      expect.anything(),
    )
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'referral-invoices', data: expect.objectContaining({ status: 'sent' }) }),
    )
    await sendReferralInvoice(payload, 'courts', 'court-1', '2026-08', stripe as unknown as Stripe)
    expect(stripe.invoices.create).toHaveBeenCalledTimes(1)
  })
})
