import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Payload } from 'payload'
import type Stripe from 'stripe'
import {
  billingPeriodEnd,
  collectionDateInDetroit,
  currentBillingMonth,
  previousBillingMonth,
} from './referral-invoices/date'
import {
  previewReferralInvoice,
  replaceReferralInvoice,
  sendReferralInvoice,
  syncReferralInvoicePayment,
} from './referral-invoices'

function mockPayload(priorInvoice?: Record<string, unknown>, pendingPayment?: Record<string, unknown>) {
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
      if (collection === 'payments') return { docs: pendingPayment ? [pendingPayment] : [], hasNextPage: false }
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
    payload: {
      find,
      findByID,
      create,
      update,
      sendEmail: vi.fn(),
      email: { defaultFromAddress: 'website@midrugtest.com' },
      logger: { error: vi.fn() },
    } as unknown as Payload,
    find,
    create,
    update,
  }
}

describe('monthly referral invoicing', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => Uint8Array.from(Buffer.from('%PDF-test')).buffer,
      }),
    )
  })
  afterEach(() => vi.unstubAllGlobals())

  it('uses the completed Detroit billing month and DST aware cutoff', () => {
    expect(currentBillingMonth(new Date('2026-09-01T01:00:00Z'))).toBe('2026-08')
    expect(previousBillingMonth(new Date('2026-09-01T01:00:00Z'))).toBe('2026-07')
    expect(previousBillingMonth(new Date('2026-09-01T14:00:00Z'))).toBe('2026-08')
    expect(billingPeriodEnd('2026-08', new Date('2026-09-24T12:00:00Z'))).toBe('2026-09-01T04:00:00.000Z')
    expect(billingPeriodEnd('2026-11', new Date('2026-12-02T12:00:00Z'))).toBe('2026-12-01T05:00:00.000Z')
    expect(collectionDateInDetroit('2026-08-12T02:00:00.000Z')).toBe('2026-08-11')
  })

  it('previews current-month balances through now but does not send a partial-month invoice', async () => {
    const { payload, find } = mockPayload()
    const month = currentBillingMonth()
    const before = new Date()
    const preview = await previewReferralInvoice(payload, 'courts', 'court-1', month)
    expect(preview.upcoming).toBe(true)
    const drugTestFind = find.mock.calls.find(([args]) => args.collection === 'drug-tests')?.[0] as
      | { where: { and: Array<{ collectionDate?: { less_than: string } }> } }
      | undefined
    const cutoff = drugTestFind?.where.and[2].collectionDate?.less_than
    expect(cutoff).toBeDefined()
    if (!cutoff) throw new Error('Missing current-month cutoff')
    expect(new Date(cutoff).getTime()).toBeGreaterThanOrEqual(before.getTime())
    expect(new Date(cutoff).getTime()).toBeLessThanOrEqual(Date.now())
    await expect(sendReferralInvoice(payload, 'courts', 'court-1', month, {} as Stripe)).rejects.toThrow(
      'completed billing month',
    )
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

  it('hides replacement when the sent invoice already matches the tests and balances', async () => {
    const { payload } = mockPayload({
      id: 'invoice-1',
      billingKey: 'courts:court-1:2026-08',
      status: 'sent',
      items: [
        {
          drugTest: 'test-1',
          client: 'client-1',
          clientName: 'Jane Doe',
          collectionDate: '2026-08-12T14:00:00.000Z',
          testType: '11-Panel Lab',
          amount: 20,
        },
        {
          drugTest: 'test-2',
          client: 'client-1',
          clientName: 'Jane Doe',
          collectionDate: '2026-08-15T14:00:00.000Z',
          testType: '17-Panel Instant',
          amount: 35,
        },
      ],
    })
    const preview = await previewReferralInvoice(payload, 'courts', 'court-1', '2026-08')
    expect(preview.replacement).toBeNull()
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

  it('can bill a new balance on a test after its previous invoice was paid', async () => {
    const { payload } = mockPayload({
      id: 'invoice-paid',
      billingKey: 'courts:court-1:2026-07',
      status: 'paid',
      items: [{ drugTest: 'test-1', amount: 20 }],
    })
    const preview = await previewReferralInvoice(payload, 'courts', 'court-1', '2026-08')
    expect(preview.items.map((item) => item.drugTest)).toEqual(['test-1', 'test-2'])
    expect(preview.amount).toBe(55)
  })

  it('stops referral invoicing when an earlier client checkout link was completed', async () => {
    const { payload, create } = mockPayload(undefined, {
      id: 'payment-1',
      stripeCheckoutSessionId: 'cs_1',
    })
    const stripe = {
      checkout: {
        sessions: { retrieve: vi.fn().mockResolvedValue({ id: 'cs_1', status: 'complete' }), expire: vi.fn() },
      },
    }
    await expect(
      sendReferralInvoice(payload, 'courts', 'court-1', '2026-08', stripe as unknown as Stripe),
    ).rejects.toThrow('Reconcile that payment')
    expect(create).not.toHaveBeenCalled()
    expect(stripe.checkout.sessions.expire).not.toHaveBeenCalled()
  })

  it('checks Stripe status for the selected referral without changing an open invoice', async () => {
    const { payload, update } = mockPayload({
      id: 'invoice-1',
      billingKey: 'courts:court-1:2026-08',
      status: 'sent',
      stripeInvoiceId: 'in_1',
      referral: { relationTo: 'courts', value: 'court-1' },
    })
    vi.mocked(payload.findByID).mockResolvedValue({
      id: 'invoice-1',
      status: 'sent',
      stripeInvoiceId: 'in_1',
      referral: { relationTo: 'courts', value: 'court-1' },
    } as never)
    const stripe = { invoices: { retrieve: vi.fn().mockResolvedValue({ id: 'in_1', status: 'open' }) } }
    await expect(
      syncReferralInvoicePayment(payload, 'invoice-1', stripe as unknown as Stripe, {
        relationTo: 'courts',
        referralId: 'other-court',
      }),
    ).rejects.toThrow('does not belong')
    expect(stripe.invoices.retrieve).not.toHaveBeenCalled()
    expect(
      await syncReferralInvoicePayment(payload, 'invoice-1', stripe as unknown as Stripe, {
        relationTo: 'courts',
        referralId: 'court-1',
      }),
    ).toEqual({ status: 'open' })
    expect(update).not.toHaveBeenCalled()
  })

  it('makes tests from a voided invoice eligible for a replacement', async () => {
    const { payload } = mockPayload({
      id: 'voided-1',
      billingKey: 'courts:court-1:2026-08:void:voided-1',
      status: 'void',
      items: [{ drugTest: 'test-1' }],
    })
    const preview = await previewReferralInvoice(payload, 'courts', 'court-1', '2026-08')
    expect(preview.items.map((item) => item.drugTest)).toEqual(['test-1', 'test-2'])
  })

  it('creates, itemizes, and emails one PDF invoice, then leaves it sent on a repeat request', async () => {
    const { payload, create, update } = mockPayload(undefined, {
      id: 'pending-checkout',
      stripeCheckoutSessionId: 'cs_old',
    })
    const stripe = {
      checkout: {
        sessions: {
          retrieve: vi.fn().mockResolvedValue({ id: 'cs_old', status: 'open' }),
          expire: vi.fn().mockResolvedValue({ id: 'cs_old', status: 'expired' }),
        },
      },
      customers: { create: vi.fn().mockResolvedValue({ id: 'cus_1' }), update: vi.fn() },
      invoices: {
        create: vi.fn().mockResolvedValue({
          id: 'in_1',
          status: 'draft',
          footer: 'Checks accepted. Make payable to MI Drug Test and mail to 410 W Robinson St, Charlevoix, MI 49720.',
        }),
        retrieve: vi.fn(),
        finalizeInvoice: vi.fn().mockResolvedValue({
          id: 'in_1',
          status: 'open',
          footer: 'Checks accepted. Make payable to MI Drug Test and mail to 410 W Robinson St, Charlevoix, MI 49720.',
          invoice_pdf: 'https://pay.stripe.com/pdf',
          hosted_invoice_url: 'https://pay.stripe.com/invoice',
        }),
        update: vi.fn(),
        sendInvoice: vi.fn(),
      },
      invoiceItems: { create: vi.fn().mockResolvedValue({ id: 'ii_1' }) },
    }
    const result = await sendReferralInvoice(payload, 'courts', 'court-1', '2026-08', stripe as unknown as Stripe)
    expect(result.status).toBe('sent')
    expect(stripe.checkout.sessions.expire).toHaveBeenCalledWith('cs_old')
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'payments', id: 'pending-checkout', data: expect.objectContaining({ status: 'voided' }) }),
    )
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'referral-invoices', data: expect.objectContaining({ amount: 55 }) }),
    )
    expect(stripe.invoices.create).toHaveBeenCalledWith(
      expect.objectContaining({
        collection_method: 'send_invoice',
        auto_advance: false,
        footer: expect.stringContaining('410 W Robinson St, Charlevoix, MI 49720'),
      }),
      expect.anything(),
    )
    expect(stripe.invoices.create.mock.calls[0][0]).not.toHaveProperty('description')
    expect(stripe.invoiceItems.create).toHaveBeenCalledTimes(2)
    expect(stripe.invoiceItems.create).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 2000, description: '11-Panel Lab — Jane Doe (2026-08-12)' }),
      expect.anything(),
    )
    for (const [parameters, options] of stripe.invoiceItems.create.mock.calls) {
      expect(parameters).not.toHaveProperty('quantity')
      expect(options.idempotencyKey).toMatch(/^referral-invoice-item:v2:/)
    }
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'referral-invoices', data: expect.objectContaining({ status: 'sent' }) }),
    )
    expect(payload.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'website@midrugtest.com',
        to: expect.any(Array),
        attachments: [expect.objectContaining({ contentType: 'application/pdf' })],
      }),
    )
    expect(stripe.invoices.sendInvoice).not.toHaveBeenCalled()
    expect(stripe.invoices.update).not.toHaveBeenCalled()
    await sendReferralInvoice(payload, 'courts', 'court-1', '2026-08', stripe as unknown as Stripe)
    expect(stripe.invoices.create).toHaveBeenCalledTimes(1)
  })

  it('resumes the existing draft after an invoice item request fails', async () => {
    const { payload, create } = mockPayload()
    const stripe = {
      customers: { create: vi.fn().mockResolvedValue({ id: 'cus_1' }), update: vi.fn() },
      invoices: {
        create: vi.fn().mockResolvedValue({
          id: 'in_1',
          status: 'draft',
          footer: 'Checks accepted. Make payable to MI Drug Test and mail to 410 W Robinson St, Charlevoix, MI 49720.',
        }),
        retrieve: vi.fn().mockResolvedValue({ id: 'in_1', status: 'draft' }),
        finalizeInvoice: vi.fn().mockResolvedValue({
          id: 'in_1',
          status: 'open',
          footer: 'Checks accepted. Make payable to MI Drug Test and mail to 410 W Robinson St, Charlevoix, MI 49720.',
          invoice_pdf: 'https://pay.stripe.com/pdf',
        }),
        update: vi.fn().mockResolvedValue({
          id: 'in_1',
          status: 'draft',
          footer: 'Checks accepted. Make payable to MI Drug Test and mail to 410 W Robinson St, Charlevoix, MI 49720.',
        }),
      },
      invoiceItems: {
        create: vi.fn().mockRejectedValueOnce(new Error('Stripe request failed')).mockResolvedValue({ id: 'ii_1' }),
      },
    }
    await expect(
      sendReferralInvoice(payload, 'courts', 'court-1', '2026-08', stripe as unknown as Stripe),
    ).rejects.toThrow('Stripe request failed')
    const result = await sendReferralInvoice(payload, 'courts', 'court-1', '2026-08', stripe as unknown as Stripe)
    expect(result.status).toBe('sent')
    expect(create).toHaveBeenCalledTimes(1)
    expect(stripe.invoices.create).toHaveBeenCalledTimes(1)
    expect(stripe.invoices.retrieve).toHaveBeenCalledWith('in_1')
    expect(stripe.invoices.update).toHaveBeenCalledWith(
      'in_1',
      expect.objectContaining({ footer: expect.stringContaining('410 W Robinson St') }),
    )
    expect(stripe.invoiceItems.create).toHaveBeenCalledTimes(3)
    expect(stripe.invoiceItems.create.mock.calls[1][0]).not.toHaveProperty('quantity')
  })

  it('retries email delivery after the invoice is finalized without creating another Stripe invoice', async () => {
    const { payload, create } = mockPayload()
    const finalized = {
      id: 'in_1',
      status: 'open',
      footer: 'Checks accepted. Make payable to MI Drug Test and mail to 410 W Robinson St, Charlevoix, MI 49720.',
      invoice_pdf: 'https://pay.stripe.com/pdf',
    }
    const stripe = {
      customers: {
        create: vi.fn().mockResolvedValue({ id: 'cus_1' }),
        retrieve: vi.fn().mockResolvedValue({ id: 'cus_1' }),
        update: vi.fn(),
      },
      invoices: {
        create: vi.fn().mockResolvedValue({
          id: 'in_1',
          status: 'draft',
          footer: 'Checks accepted. Make payable to MI Drug Test and mail to 410 W Robinson St, Charlevoix, MI 49720.',
        }),
        retrieve: vi.fn().mockResolvedValue(finalized),
        finalizeInvoice: vi.fn().mockResolvedValue(finalized),
        update: vi.fn(),
        sendInvoice: vi.fn(),
      },
      invoiceItems: { create: vi.fn().mockResolvedValue({ id: 'ii_1' }) },
    }
    vi.mocked(payload.sendEmail).mockRejectedValueOnce(new Error('SMTP unavailable'))
    await expect(
      sendReferralInvoice(payload, 'courts', 'court-1', '2026-08', stripe as unknown as Stripe),
    ).rejects.toThrow('SMTP unavailable')
    expect((await previewReferralInvoice(payload, 'courts', 'court-1', '2026-08')).status).toBe('preparing')
    expect(create).toHaveBeenCalledTimes(1)
    const result = await sendReferralInvoice(payload, 'courts', 'court-1', '2026-08', stripe as unknown as Stripe)
    expect(result.status).toBe('sent')
    expect(stripe.invoices.create).toHaveBeenCalledTimes(1)
    expect(stripe.invoices.finalizeInvoice).toHaveBeenCalledTimes(1)
    expect(payload.sendEmail).toHaveBeenCalledTimes(2)
    expect(stripe.invoices.sendInvoice).not.toHaveBeenCalled()
  })

  it('emails an existing Stripe-sent invoice only when an admin requests the PDF', async () => {
    const prior = {
      id: 'invoice-1',
      billingKey: 'courts:court-1:2026-08',
      billingMonth: '2026-08',
      status: 'sent',
      amount: 55,
      billingEmail: 'billing@court.test',
      stripeInvoiceId: 'in_1',
      items: [{ drugTest: 'test-1', amount: 55 }],
    }
    const { payload } = mockPayload(prior)
    const stripe = {
      invoices: {
        retrieve: vi.fn().mockResolvedValue({
          id: 'in_1',
          status: 'open',
          footer: null,
          description: '2026-08 drug tests\nJane Doe — 2026-08-12',
          invoice_pdf: 'https://pay.stripe.com/pdf',
        }),
        update: vi.fn(),
      },
    }
    await sendReferralInvoice(payload, 'courts', 'court-1', '2026-08', stripe as unknown as Stripe)
    expect(payload.sendEmail).not.toHaveBeenCalled()
    await sendReferralInvoice(payload, 'courts', 'court-1', '2026-08', stripe as unknown as Stripe, {
      emailExisting: true,
    })
    expect(stripe.invoices.update).not.toHaveBeenCalled()
    expect(payload.sendEmail).toHaveBeenCalledTimes(1)
  })

  it('replaces an unpaid invoice with current balances, including an August test added later', async () => {
    const oldInvoice = {
      id: 'invoice-old',
      billingKey: 'courts:court-1:2026-08',
      billingMonth: '2026-08',
      status: 'sent',
      billingEmail: 'billing@court.test',
      stripeInvoiceId: 'in_old',
      amount: 20,
      items: [{ drugTest: 'test-1', amount: 20 }],
    }
    const { payload, create, update } = mockPayload(oldInvoice)
    const stripe = {
      customers: { create: vi.fn().mockResolvedValue({ id: 'cus_1' }), update: vi.fn() },
      invoices: {
        retrieve: vi.fn().mockResolvedValue({ id: 'in_old', status: 'open', amount_paid: 0 }),
        voidInvoice: vi.fn().mockResolvedValue({ id: 'in_old', status: 'void' }),
        create: vi.fn().mockResolvedValue({
          id: 'in_new',
          status: 'draft',
          footer: 'Checks accepted. Make payable to MI Drug Test and mail to 410 W Robinson St, Charlevoix, MI 49720.',
        }),
        finalizeInvoice: vi.fn().mockResolvedValue({
          id: 'in_new',
          status: 'open',
          footer: 'Checks accepted. Make payable to MI Drug Test and mail to 410 W Robinson St, Charlevoix, MI 49720.',
          invoice_pdf: 'https://pay.stripe.com/pdf',
        }),
        update: vi.fn(),
      },
      invoiceItems: { create: vi.fn().mockResolvedValue({ id: 'ii_1' }) },
    }

    const preview = await previewReferralInvoice(payload, 'courts', 'court-1', '2026-08')
    expect(preview.amount).toBe(20)
    expect(preview.replacement?.amount).toBe(55)
    expect(preview.replacement?.items.map((item) => item.drugTest)).toEqual(['test-1', 'test-2'])

    const result = await replaceReferralInvoice(payload, 'courts', 'court-1', '2026-08', stripe as unknown as Stripe)
    expect(result.status).toBe('sent')
    expect(stripe.invoices.voidInvoice).toHaveBeenCalledWith('in_old', {}, expect.anything())
    expect(stripe.invoices.voidInvoice.mock.invocationCallOrder[0]).toBeLessThan(create.mock.invocationCallOrder[0])
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'referral-invoices',
        id: 'invoice-old',
        data: expect.objectContaining({ status: 'void', billingKey: 'courts:court-1:2026-08:void:invoice-old' }),
      }),
    )
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'referral-invoices',
        data: expect.objectContaining({
          amount: 55,
          replacesInvoice: 'invoice-old',
          replacesInvoiceNumber: 'in_old',
          items: expect.arrayContaining([expect.objectContaining({ drugTest: 'test-2' })]),
        }),
      }),
    )
    expect(stripe.invoices.create).toHaveBeenCalledWith(
      expect.objectContaining({ description: 'Replaces invoice in_old' }),
      expect.objectContaining({ idempotencyKey: 'referral-invoice:invoice-1' }),
    )
    expect(stripe.invoiceItems.create).toHaveBeenCalledTimes(2)
    expect(payload.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ html: expect.stringContaining('Please disregard the earlier invoice') }),
    )
    const september = await previewReferralInvoice(payload, 'courts', 'court-1', '2026-09')
    expect(september.items).toHaveLength(0)
  })

  it('does not replace a paid or partially paid Stripe invoice', async () => {
    for (const stripeInvoice of [
      { id: 'in_old', status: 'paid', amount_paid: 2000 },
      { id: 'in_old', status: 'open', amount_paid: 500 },
    ]) {
      const { payload, create, update } = mockPayload({
        id: 'invoice-old',
        billingKey: 'courts:court-1:2026-08',
        billingMonth: '2026-08',
        status: 'sent',
        billingEmail: 'billing@court.test',
        stripeInvoiceId: 'in_old',
        amount: 20,
        items: [{ drugTest: 'test-1', amount: 20 }],
      })
      const stripe = {
        invoices: {
          retrieve: vi.fn().mockResolvedValue(stripeInvoice),
          voidInvoice: vi.fn(),
        },
      }
      await expect(
        replaceReferralInvoice(payload, 'courts', 'court-1', '2026-08', stripe as unknown as Stripe),
      ).rejects.toThrow()
      expect(stripe.invoices.voidInvoice).not.toHaveBeenCalled()
      expect(create).not.toHaveBeenCalled()
      expect(update).not.toHaveBeenCalled()
    }
  })

  it('keeps the local invoice active if Stripe does not void it', async () => {
    const { payload, create, update } = mockPayload({
      id: 'invoice-old',
      billingKey: 'courts:court-1:2026-08',
      billingMonth: '2026-08',
      status: 'sent',
      billingEmail: 'billing@court.test',
      stripeInvoiceId: 'in_old',
      amount: 20,
      items: [{ drugTest: 'test-1', amount: 20 }],
    })
    const stripe = {
      invoices: {
        retrieve: vi.fn().mockResolvedValue({ id: 'in_old', status: 'open', amount_paid: 0 }),
        voidInvoice: vi.fn().mockResolvedValue({ id: 'in_old', status: 'open' }),
      },
    }
    await expect(
      replaceReferralInvoice(payload, 'courts', 'court-1', '2026-08', stripe as unknown as Stripe),
    ).rejects.toThrow('did not void')
    expect(update).not.toHaveBeenCalled()
    expect(create).not.toHaveBeenCalled()
  })
})
