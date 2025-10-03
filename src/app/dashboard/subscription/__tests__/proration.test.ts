import { describe, it, expect, vi, beforeEach } from 'vitest'
import { calculateProratedRefund } from '../utils/calculateProratedRefund'
import type Stripe from 'stripe'

// Create mock Stripe instance
const createMockStripe = () => {
  return {
    subscriptions: {
      retrieve: vi.fn(),
    },
    invoices: {
      retrieve: vi.fn(),
    },
  } as unknown as Stripe
}

describe('calculateProratedRefund', () => {
  let mockStripe: Stripe

  beforeEach(() => {
    mockStripe = createMockStripe()
    vi.clearAllMocks()
  })

  it('should calculate correct refund for half billing period remaining', async () => {
    const now = Math.floor(Date.now() / 1000)
    const periodStart = now - 15 * 86400 // 15 days ago
    const periodEnd = now + 15 * 86400 // 15 days from now
    const monthlyPrice = 10000 // $100.00

    vi.mocked(mockStripe.subscriptions.retrieve).mockResolvedValue({
      id: 'sub_123',
      current_period_start: periodStart,
      current_period_end: periodEnd,
      items: {
        data: [
          {
            price: {
              unit_amount: monthlyPrice,
            },
          } as any,
        ],
      } as any,
      latest_invoice: 'in_123',
    } as any)

    vi.mocked(mockStripe.invoices.retrieve).mockResolvedValue({
      charge: 'ch_123',
    } as any)

    const result = await calculateProratedRefund(mockStripe, 'sub_123')

    // 15 days remaining out of 30 = 50% refund
    expect(result.refundAmount).toBe(5000) // $50.00
    expect(result.daysRemaining).toBe(15)
    expect(result.latestChargeId).toBe('ch_123')
  })

  it('should return 0 refund when billing period has ended', async () => {
    const now = Math.floor(Date.now() / 1000)
    const periodStart = now - 30 * 86400 // 30 days ago
    const periodEnd = now - 1 * 86400 // ended yesterday
    const monthlyPrice = 10000

    vi.mocked(mockStripe.subscriptions.retrieve).mockResolvedValue({
      id: 'sub_123',
      current_period_start: periodStart,
      current_period_end: periodEnd,
      items: {
        data: [{ price: { unit_amount: monthlyPrice } } as any],
      } as any,
      latest_invoice: 'in_123',
    } as any)

    vi.mocked(mockStripe.invoices.retrieve).mockResolvedValue({
      charge: 'ch_123',
    } as any)

    const result = await calculateProratedRefund(mockStripe, 'sub_123')

    expect(result.refundAmount).toBe(0)
    expect(result.daysRemaining).toBe(0)
  })

  it('should handle subscription with no invoice', async () => {
    const now = Math.floor(Date.now() / 1000)
    const periodStart = now - 10 * 86400
    const periodEnd = now + 20 * 86400

    vi.mocked(mockStripe.subscriptions.retrieve).mockResolvedValue({
      id: 'sub_123',
      current_period_start: periodStart,
      current_period_end: periodEnd,
      items: {
        data: [{ price: { unit_amount: 10000 } } as any],
      } as any,
      latest_invoice: null,
    } as any)

    const result = await calculateProratedRefund(mockStripe, 'sub_123')

    expect(result.latestChargeId).toBeNull()
    expect(result.refundAmount).toBeGreaterThan(0) // Should still calculate refund
  })

  it('should round down prorated amounts to avoid over-refunding', async () => {
    const now = Math.floor(Date.now() / 1000)
    const periodStart = now - 20 * 86400
    const periodEnd = now + 10 * 86400
    const monthlyPrice = 9999 // Odd amount that will create decimal

    vi.mocked(mockStripe.subscriptions.retrieve).mockResolvedValue({
      id: 'sub_123',
      current_period_start: periodStart,
      current_period_end: periodEnd,
      items: {
        data: [{ price: { unit_amount: monthlyPrice } } as any],
      } as any,
      latest_invoice: 'in_123',
    } as any)

    vi.mocked(mockStripe.invoices.retrieve).mockResolvedValue({
      charge: 'ch_123',
    } as any)

    const result = await calculateProratedRefund(mockStripe, 'sub_123')

    // Ensure we round down and return integer
    expect(result.refundAmount).toBeLessThanOrEqual(monthlyPrice)
    expect(Number.isInteger(result.refundAmount)).toBe(true)
  })

  it('should calculate correct refund with 1 day remaining', async () => {
    const now = Math.floor(Date.now() / 1000)
    const periodStart = now - 29 * 86400 // 29 days ago
    const periodEnd = now + 1 * 86400 // 1 day remaining
    const monthlyPrice = 30000 // $300.00

    vi.mocked(mockStripe.subscriptions.retrieve).mockResolvedValue({
      id: 'sub_123',
      current_period_start: periodStart,
      current_period_end: periodEnd,
      items: {
        data: [{ price: { unit_amount: monthlyPrice } } as any],
      } as any,
      latest_invoice: 'in_123',
    } as any)

    vi.mocked(mockStripe.invoices.retrieve).mockResolvedValue({
      charge: 'ch_123',
    } as any)

    const result = await calculateProratedRefund(mockStripe, 'sub_123')

    // 1 day out of 30 = ~$10
    expect(result.refundAmount).toBeGreaterThan(900) // At least $9
    expect(result.refundAmount).toBeLessThan(1100) // At most $11
    expect(result.daysRemaining).toBe(1)
  })

  it('should handle subscription with no price amount', async () => {
    const now = Math.floor(Date.now() / 1000)
    const periodStart = now - 15 * 86400
    const periodEnd = now + 15 * 86400

    vi.mocked(mockStripe.subscriptions.retrieve).mockResolvedValue({
      id: 'sub_123',
      current_period_start: periodStart,
      current_period_end: periodEnd,
      items: {
        data: [{ price: { unit_amount: null } } as any],
      } as any,
      latest_invoice: 'in_123',
    } as any)

    vi.mocked(mockStripe.invoices.retrieve).mockResolvedValue({
      charge: 'ch_123',
    } as any)

    const result = await calculateProratedRefund(mockStripe, 'sub_123')

    expect(result.refundAmount).toBe(0)
  })

  it('should return correct period end date', async () => {
    const now = Math.floor(Date.now() / 1000)
    const periodStart = now - 15 * 86400
    const periodEnd = now + 15 * 86400
    const expectedEndDate = new Date(periodEnd * 1000)

    vi.mocked(mockStripe.subscriptions.retrieve).mockResolvedValue({
      id: 'sub_123',
      current_period_start: periodStart,
      current_period_end: periodEnd,
      items: {
        data: [{ price: { unit_amount: 10000 } } as any],
      } as any,
      latest_invoice: 'in_123',
    } as any)

    vi.mocked(mockStripe.invoices.retrieve).mockResolvedValue({
      charge: 'ch_123',
    } as any)

    const result = await calculateProratedRefund(mockStripe, 'sub_123')

    expect(result.periodEnd.getTime()).toBe(expectedEndDate.getTime())
  })

  it('should handle invoice with null charge', async () => {
    const now = Math.floor(Date.now() / 1000)
    const periodStart = now - 15 * 86400
    const periodEnd = now + 15 * 86400

    vi.mocked(mockStripe.subscriptions.retrieve).mockResolvedValue({
      id: 'sub_123',
      current_period_start: periodStart,
      current_period_end: periodEnd,
      items: {
        data: [{ price: { unit_amount: 10000 } } as any],
      } as any,
      latest_invoice: 'in_123',
    } as any)

    vi.mocked(mockStripe.invoices.retrieve).mockResolvedValue({
      charge: null,
    } as any)

    const result = await calculateProratedRefund(mockStripe, 'sub_123')

    expect(result.latestChargeId).toBeNull()
    expect(result.refundAmount).toBeGreaterThan(0)
  })

  it('should calculate correct refund for subscription canceled 1 day after payment (29 days remaining)', async () => {
    const now = Math.floor(Date.now() / 1000)
    const periodStart = now - 1 * 86400 // 1 day ago (just started)
    const periodEnd = now + 29 * 86400 // 29 days remaining
    const monthlyPrice = 30000 // $300.00

    vi.mocked(mockStripe.subscriptions.retrieve).mockResolvedValue({
      id: 'sub_123',
      current_period_start: periodStart,
      current_period_end: periodEnd,
      items: {
        data: [{ price: { unit_amount: monthlyPrice } } as any],
      } as any,
      latest_invoice: 'in_123',
    } as any)

    vi.mocked(mockStripe.invoices.retrieve).mockResolvedValue({
      charge: 'ch_123',
    } as any)

    const result = await calculateProratedRefund(mockStripe, 'sub_123')

    // Prorated would be $290, but capped at 85% = $255
    const maxRefund = Math.floor(monthlyPrice * 0.85)
    expect(result.refundAmount).toBe(maxRefund) // $255.00 (25500 cents)
    expect(result.refundAmount).toBe(25500)
    expect(result.daysRemaining).toBe(29)

    // Verify customer keeps minimum 15%
    const customerPays = monthlyPrice - result.refundAmount
    expect(customerPays).toBe(4500) // $45.00 minimum retention
  })

  it('should NOT refund full amount even when canceled very early', async () => {
    const now = Math.floor(Date.now() / 1000)
    const periodStart = now - 1 * 86400 // 1 day used
    const periodEnd = now + 29 * 86400 // 29 days left
    const monthlyPrice = 10000 // $100.00

    vi.mocked(mockStripe.subscriptions.retrieve).mockResolvedValue({
      id: 'sub_123',
      current_period_start: periodStart,
      current_period_end: periodEnd,
      items: {
        data: [{ price: { unit_amount: monthlyPrice } } as any],
      } as any,
      latest_invoice: 'in_123',
    } as any)

    vi.mocked(mockStripe.invoices.retrieve).mockResolvedValue({
      charge: 'ch_123',
    } as any)

    const result = await calculateProratedRefund(mockStripe, 'sub_123')

    // Prorated would be $96.66 (29/30), but capped at 85% = $85
    expect(result.refundAmount).toBeLessThan(monthlyPrice) // Must be less than full amount
    expect(result.refundAmount).toBe(8500) // $85.00 (85% cap)

    // Customer keeps minimum 15%
    const customerPays = monthlyPrice - result.refundAmount
    expect(customerPays).toBeGreaterThan(0) // Must pay something
    expect(customerPays).toBe(1500) // $15.00 minimum retention
  })

  it('should calculate 50% refund when subscription is exactly halfway through billing period', async () => {
    const now = Math.floor(Date.now() / 1000)
    const periodStart = now - 15 * 86400 // Started 15 days ago
    const periodEnd = now + 15 * 86400 // 15 days remaining
    const monthlyPrice = 10000 // $100.00

    vi.mocked(mockStripe.subscriptions.retrieve).mockResolvedValue({
      id: 'sub_123',
      current_period_start: periodStart,
      current_period_end: periodEnd,
      items: {
        data: [{ price: { unit_amount: monthlyPrice } } as any],
      } as any,
      latest_invoice: 'in_123',
    } as any)

    vi.mocked(mockStripe.invoices.retrieve).mockResolvedValue({
      charge: 'ch_123',
    } as any)

    const result = await calculateProratedRefund(mockStripe, 'sub_123')

    // Exactly half the billing period used = exactly 50% refund
    expect(result.refundAmount).toBe(5000) // $50.00
    expect(result.daysRemaining).toBe(15)

    // Customer pays for 15 days
    const customerPays = monthlyPrice - result.refundAmount
    expect(customerPays).toBe(5000) // $50.00 for 15 days used
  })

  it('should cap refund at 85% for early cancellation to cover Stripe fees', async () => {
    const now = Math.floor(Date.now() / 1000)
    const periodStart = now - 1 * 86400 // 1 day used
    const periodEnd = now + 29 * 86400 // 29 days remaining
    const monthlyPrice = 15000 // $150.00

    vi.mocked(mockStripe.subscriptions.retrieve).mockResolvedValue({
      id: 'sub_123',
      current_period_start: periodStart,
      current_period_end: periodEnd,
      items: {
        data: [{ price: { unit_amount: monthlyPrice } } as any],
      } as any,
      latest_invoice: 'in_123',
    } as any)

    vi.mocked(mockStripe.invoices.retrieve).mockResolvedValue({
      charge: 'ch_123',
    } as any)

    const result = await calculateProratedRefund(mockStripe, 'sub_123')

    // Prorated would be ~$145, but capped at 85% = $127.50
    const maxRefund = Math.floor(monthlyPrice * 0.85)
    expect(result.refundAmount).toBe(maxRefund) // $127.50 (12750 cents)
    expect(result.refundAmount).toBe(12750)

    // Customer keeps 15% minimum ($22.50)
    const customerPays = monthlyPrice - result.refundAmount
    expect(customerPays).toBe(2250) // $22.50 minimum retention
  })

  it('should NOT apply 85% cap when prorated amount is already less than cap', async () => {
    const now = Math.floor(Date.now() / 1000)
    const periodStart = now - 20 * 86400 // 20 days used (2/3 of period)
    const periodEnd = now + 10 * 86400 // 10 days remaining (1/3 of period)
    const monthlyPrice = 15000 // $150.00

    vi.mocked(mockStripe.subscriptions.retrieve).mockResolvedValue({
      id: 'sub_123',
      current_period_start: periodStart,
      current_period_end: periodEnd,
      items: {
        data: [{ price: { unit_amount: monthlyPrice } } as any],
      } as any,
      latest_invoice: 'in_123',
    } as any)

    vi.mocked(mockStripe.invoices.retrieve).mockResolvedValue({
      charge: 'ch_123',
    } as any)

    const result = await calculateProratedRefund(mockStripe, 'sub_123')

    // Prorated: 10/30 days = $50, which is less than 85% cap ($127.50)
    // Should use prorated amount, not cap
    expect(result.refundAmount).toBe(5000) // $50.00
    expect(result.refundAmount).toBeLessThan(Math.floor(monthlyPrice * 0.85))

    // Customer pays for 20 days used
    const customerPays = monthlyPrice - result.refundAmount
    expect(customerPays).toBe(10000) // $100.00 for 20 days
  })

  it('should apply 85% cap for $100 subscription canceled after 1 day', async () => {
    const now = Math.floor(Date.now() / 1000)
    const periodStart = now - 1 * 86400 // 1 day used
    const periodEnd = now + 29 * 86400 // 29 days left
    const monthlyPrice = 10000 // $100.00

    vi.mocked(mockStripe.subscriptions.retrieve).mockResolvedValue({
      id: 'sub_123',
      current_period_start: periodStart,
      current_period_end: periodEnd,
      items: {
        data: [{ price: { unit_amount: monthlyPrice } } as any],
      } as any,
      latest_invoice: 'in_123',
    } as any)

    vi.mocked(mockStripe.invoices.retrieve).mockResolvedValue({
      charge: 'ch_123',
    } as any)

    const result = await calculateProratedRefund(mockStripe, 'sub_123')

    // Prorated would be $96.66, cap is $85.00
    const maxRefund = Math.floor(monthlyPrice * 0.85)
    expect(result.refundAmount).toBe(maxRefund) // $85.00 (8500 cents)
    expect(result.refundAmount).toBe(8500)

    // Customer keeps minimum 15% ($15)
    const customerPays = monthlyPrice - result.refundAmount
    expect(customerPays).toBe(1500) // $15.00 minimum
  })
})