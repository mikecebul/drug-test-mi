import { expect, it, vi } from 'vitest'
import type { Payload } from 'payload'
import type Stripe from 'stripe'
import { closePendingClientCheckoutSessions } from './closePendingClientCheckoutSessions'

function setup(sessionStatus: 'complete' | 'open' | 'expired') {
  const payload = {
    find: vi.fn().mockResolvedValue({
      docs: [{ id: 'payment-1', stripeCheckoutSessionId: 'cs_1' }],
      hasNextPage: false,
    }),
    update: vi.fn(),
  } as unknown as Payload
  const stripe = {
    checkout: {
      sessions: {
        retrieve: vi.fn().mockResolvedValue({ id: 'cs_1', status: sessionStatus }),
        expire: vi.fn(),
      },
    },
  } as unknown as Stripe
  return { payload, stripe }
}

it('blocks a new link while an ACH checkout has completed but its payment is pending', async () => {
  const { payload, stripe } = setup('complete')
  await expect(closePendingClientCheckoutSessions(payload, stripe, 'test-1')).rejects.toThrow(
    'still processing or awaiting reconciliation',
  )
  expect(payload.update).not.toHaveBeenCalled()
  expect(stripe.checkout.sessions.expire).not.toHaveBeenCalled()
})

it('expires an unused link before another one can be issued', async () => {
  const { payload, stripe } = setup('open')
  await closePendingClientCheckoutSessions(payload, stripe, 'test-1')
  expect(stripe.checkout.sessions.expire).toHaveBeenCalledWith('cs_1')
  expect(payload.update).toHaveBeenCalledWith(
    expect.objectContaining({ collection: 'payments', id: 'payment-1', data: expect.objectContaining({ status: 'voided' }) }),
  )
})
