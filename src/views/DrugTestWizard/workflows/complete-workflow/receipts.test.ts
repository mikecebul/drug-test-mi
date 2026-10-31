import type { Payload } from 'payload'
import { beforeEach, describe, expect, test, vi } from 'vitest'

const { startTerminal, applyIncomingPayment } = vi.hoisted(() => ({
  startTerminal: vi.fn().mockResolvedValue({ success: true }),
  applyIncomingPayment: vi.fn().mockResolvedValue({ id: 'payment-1', reservedForBookingAmount: 35 }),
}))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/collections/Payments/services/stripeTerminal', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/collections/Payments/services/stripeTerminal')>()),
  startGuidedTerminalPayment: startTerminal,
}))
vi.mock('@/collections/Payments/services/applyPayment', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/collections/Payments/services/applyPayment')>()),
  applyIncomingPayment,
}))
vi.mock('@/collections/Payments/services/withPayloadTransaction', () => ({
  withPayloadTransaction: async (_payload: Payload, operation: (req: object) => Promise<unknown>) => operation({}),
}))

import { recordBookingPayment, startBookingTerminalPayment } from './actions'

function fixture() {
  const booking = {
    id: 'booking-1',
    scheduledTestType: '17-panel-instant',
    relatedClient: { id: 'client-1', firstName: 'Jordan', email: 'client@example.test' },
    payment: { amountDue: 35, amountPaid: 0 },
    receiptEmailClaimedAt: null as string | null,
  }
  const sendEmail = vi.fn().mockResolvedValue({})
  const payload = {
    findByID: vi.fn().mockImplementation(async () => booking),
    find: vi.fn().mockResolvedValue({ docs: [] }),
    update: vi.fn().mockImplementation(async ({ collection, data }) => {
      if (collection === 'bookings') Object.assign(booking, data)
      return collection === 'bookings' ? booking : { id: 'payment-1', ...data }
    }),
    db: {
      updateOne: vi.fn().mockImplementation(async ({ data }) => {
        if (booking.receiptEmailClaimedAt) return null
        Object.assign(booking, data)
        return booking
      }),
    },
    sendEmail,
    email: { defaultFromAddress: 'info@example.test' },
    logger: { info: vi.fn(), warn: vi.fn() },
  } as unknown as Payload
  const req = { payload, user: { collection: 'admins', id: 'admin-1' } } as Parameters<typeof recordBookingPayment>[1]
  return { booking, payload, req, sendEmail }
}

describe('guided payment receipt timing', () => {
  beforeEach(() => vi.clearAllMocks())

  test('repeated unpaid payment-step submissions never send an email', async () => {
    const f = fixture()
    for (const operationId of ['first-next', 'next-after-back', 'next-after-reload']) {
      expect(
        await recordBookingPayment(
          {
            bookingId: f.booking.id,
            amountReceived: 0,
            method: 'cash',
            sendReceipt: true,
            operationId,
          },
          f.req,
        ),
      ).toMatchObject({ success: true, receipt: null })
    }
    expect(f.sendEmail).not.toHaveBeenCalled()
  })

  test('cash sends immediately; a second payment operation cannot send a duplicate visit receipt', async () => {
    const f = fixture()
    const input = { bookingId: f.booking.id, amountReceived: 35, method: 'cash' as const, sendReceipt: true }
    expect(await recordBookingPayment({ ...input, operationId: 'first-payment' }, f.req)).toMatchObject({
      success: true,
      receipt: { sent: true },
    })
    expect(f.sendEmail).toHaveBeenCalledTimes(1)
    expect(await recordBookingPayment({ ...input, operationId: 'additional-payment' }, f.req)).toMatchObject({
      success: true,
      receipt: null,
    })
    expect(f.sendEmail).toHaveBeenCalledTimes(1)
  })

  test.each(['cash-claim', 'stripe-history', 'none'])('Terminal respects %s receipt history', async (history) => {
    const f = fixture()
    if (history === 'cash-claim') f.booking.receiptEmailClaimedAt = new Date().toISOString()
    if (history === 'stripe-history')
      vi.mocked(f.payload.find).mockResolvedValue({ docs: [{ id: 'old-payment' }] } as never)
    await startBookingTerminalPayment(
      { bookingId: f.booking.id, amountReceived: 10, operationId: 'card-payment' },
      f.req,
    )
    expect(startTerminal).toHaveBeenCalledWith(
      expect.objectContaining({
        receiptEmail: history === 'none' ? 'client@example.test' : null,
      }),
    )
  })
})
