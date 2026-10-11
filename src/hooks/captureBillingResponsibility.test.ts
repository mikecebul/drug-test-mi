import { describe, expect, it, vi } from 'vitest'
import type { PayloadRequest } from 'payload'
import { captureBookingBillingResponsibility, captureTestBillingResponsibility } from './captureBillingResponsibility'

const payload = () => ({
  findByID: vi.fn(async ({ collection }: { collection: string }) =>
    collection === 'clients' ? { referral: { relationTo: 'courts', value: 'court-1' } } : { isBillable: true },
  ),
})
const args = (
  data: Record<string, unknown>,
  operation: 'create' | 'update' = 'create',
  originalDoc: Record<string, unknown> = {},
) => ({
  data,
  operation,
  originalDoc,
  req: { payload: payload() } as unknown as PayloadRequest,
  collection: {} as never,
  context: {},
})

describe('server-owned billing snapshots', () => {
  it('ignores a new booking’s browser-provided payer choice', async () => {
    const result = await captureBookingBillingResponsibility(
      args({ relatedClient: 'client-1', billingResponsibility: { payer: 'client' } }),
    )
    expect(result.billingResponsibility).toEqual({
      payer: 'referral',
      referral: { relationTo: 'courts', value: 'court-1' },
    })
  })
  it('can link a previously unlinked prepaid booking and keeps its payment client-owned', async () => {
    const result = await captureBookingBillingResponsibility(
      args({ relatedClient: 'client-1' }, 'update', {
        payment: { status: 'paid', amountPaid: 35, method: 'pre-paid' },
      }),
    )
    expect(result.billingResponsibility).toEqual({ payer: 'client', referral: null })
  })
  it('leaves historical snapshots absent during unrelated edits', async () => {
    const input = args({ notes: 'Edited' }, 'update', { relatedClient: 'client-1' })
    expect(await captureBookingBillingResponsibility(input)).not.toHaveProperty('billingResponsibility')
    expect(await captureTestBillingResponsibility(input)).not.toHaveProperty('billingResponsibility')
    expect(input.req.payload.findByID).not.toHaveBeenCalled()
  })
  it('rejects a client replacement after payment', async () => {
    await expect(
      captureBookingBillingResponsibility(
        args({ relatedClient: 'client-2' }, 'update', { relatedClient: 'client-1', payment: { amountPaid: 35 } }),
      ),
    ).rejects.toThrow('client cannot change')
  })
  it('copies a booking exception to a test and rejects a booking owned by another client', async () => {
    const input = args({
      relatedClient: 'client-1',
      sourceBooking: 'booking-1',
      billingResponsibility: { payer: 'referral' },
    })
    vi.mocked(input.req.payload.findByID).mockResolvedValue({
      relatedClient: 'client-1',
      billingResponsibility: { payer: 'client' },
    } as never)
    expect((await captureTestBillingResponsibility(input)).billingResponsibility).toEqual({
      payer: 'client',
      referral: null,
    })
    vi.mocked(input.req.payload.findByID).mockResolvedValue({ relatedClient: 'client-2' } as never)
    await expect(captureTestBillingResponsibility(input)).rejects.toThrow('another client')
  })
})
