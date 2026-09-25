import { expect, it, vi } from 'vitest'
import type { Payload } from 'payload'
import type Stripe from 'stripe'
import { recordReferralCheckPayment } from '../referral-invoices'
import { settleReferralInvoice } from './settle'

vi.mock('./settle', () => ({ settleReferralInvoice: vi.fn() }))

it('marks an open Stripe invoice paid outside Stripe and settles it locally', async () => {
  const invoice = {
    id: 'local-1',
    referral: { relationTo: 'courts', value: 'court-1' },
    status: 'sent',
    stripeInvoiceId: 'in_1',
  }
  const payload = {
    findByID: vi.fn().mockResolvedValue(invoice),
    update: vi.fn().mockResolvedValue({}),
  } as unknown as Payload
  const paid = { id: 'in_1', status: 'paid', metadata: { referralInvoiceId: 'local-1' } }
  const stripe = {
    invoices: {
      retrieve: vi.fn().mockResolvedValue({ id: 'in_1', status: 'open', amount_paid: 0 }),
      pay: vi.fn().mockResolvedValue(paid),
    },
  } as unknown as Stripe

  await recordReferralCheckPayment(payload, 'local-1', 'courts', 'court-1', '1234', '2026-09-24T16:00:00.000Z', stripe)
  expect(payload.update).toHaveBeenCalledWith(
    expect.objectContaining({
      collection: 'referral-invoices',
      data: { paymentMethod: 'check', checkNumber: '1234', checkReceivedAt: '2026-09-24T16:00:00.000Z' },
    }),
  )
  expect(stripe.invoices.pay).toHaveBeenCalledWith('in_1', { paid_out_of_band: true }, expect.anything())
  expect(settleReferralInvoice).toHaveBeenCalledWith(payload, paid)
})

it('rejects a partial Stripe payment so a full check cannot double settle the invoice', async () => {
  const payload = {
    findByID: vi.fn().mockResolvedValue({
      id: 'local-1',
      referral: { relationTo: 'courts', value: 'court-1' },
      status: 'sent',
      stripeInvoiceId: 'in_1',
    }),
    update: vi.fn(),
  } as unknown as Payload
  const stripe = {
    invoices: { retrieve: vi.fn().mockResolvedValue({ id: 'in_1', status: 'open', amount_paid: 500 }), pay: vi.fn() },
  } as unknown as Stripe
  await expect(
    recordReferralCheckPayment(payload, 'local-1', 'courts', 'court-1', '', '2026-09-24T16:00:00.000Z', stripe),
  ).rejects.toThrow('partial online payment')
  expect(payload.update).not.toHaveBeenCalled()
  expect(stripe.invoices.pay).not.toHaveBeenCalled()
})

it('clears the local check marker when Stripe leaves the invoice open', async () => {
  const payload = {
    findByID: vi.fn().mockResolvedValue({
      id: 'local-1',
      referral: { relationTo: 'courts', value: 'court-1' },
      status: 'sent',
      stripeInvoiceId: 'in_1',
    }),
    update: vi.fn().mockResolvedValue({}),
  } as unknown as Payload
  const stripe = {
    invoices: {
      retrieve: vi.fn().mockResolvedValue({ id: 'in_1', status: 'open', amount_paid: 0 }),
      pay: vi.fn().mockRejectedValue(new Error('Stripe unavailable')),
    },
  } as unknown as Stripe
  await expect(
    recordReferralCheckPayment(payload, 'local-1', 'courts', 'court-1', '', '2026-09-24T16:00:00.000Z', stripe),
  ).rejects.toThrow('Stripe unavailable')
  expect(payload.update).toHaveBeenLastCalledWith(
    expect.objectContaining({
      collection: 'referral-invoices',
      data: { paymentMethod: null, checkNumber: null, checkReceivedAt: null },
    }),
  )
})
