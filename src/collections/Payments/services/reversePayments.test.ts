import type { Payload, PayloadRequest } from 'payload'
import { describe, expect, test, vi } from 'vitest'

import { reversePostedPayments } from './reversePayments'

function createPayload(input: {
  clientCredit: number
  drugTests?: Record<string, { amountDue: number; amountPaid: number; balanceDue: number }>
}) {
  return {
    findByID: vi.fn().mockImplementation(async ({ collection, id }) => {
      if (collection === 'clients') return { id, creditBalance: input.clientCredit }
      const payment = input.drugTests?.[String(id)]
      if (!payment) throw new Error(`Missing test ${id}`)
      return { id, payment: { ...payment, status: payment.balanceDue > 0 ? 'partial' : 'paid' } }
    }),
    update: vi.fn().mockImplementation(async ({ collection, id, data }) => ({ collection, id, ...data })),
  }
}

describe('payment reversals', () => {
  test('reopens allocated tests, restores used credit, and preserves voided ledger records', async () => {
    const req = { transactionID: 'transaction-1' } as Partial<PayloadRequest>
    const payload = createPayload({
      clientCredit: 10,
      drugTests: {
        'old-test': { amountDue: 40, amountPaid: 40, balanceDue: 0 },
      },
    })

    const result = await reversePostedPayments({
      payload: payload as unknown as Payload,
      clientId: 'client-1',
      reason: 'Guided payment undone before sample collection',
      req,
      payments: [
        {
          id: 'credit-payment',
          amount: 40,
          method: 'credit',
          source: 'credit-application',
          status: 'posted',
          creditAmount: 0,
          allocations: [{ id: 'allocation-1', drugTest: 'old-test', amount: 40 }],
        },
      ],
    })

    expect(result).toMatchObject({
      creditRestored: 40,
      creditRemoved: 0,
      nextCredit: 50,
      reversedAllocationAmount: 40,
      voidedPaymentCount: 1,
    })
    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'drug-tests',
        id: 'old-test',
        data: expect.objectContaining({
          payment: expect.objectContaining({ amountPaid: 0, balanceDue: 40, status: 'unpaid' }),
        }),
        req,
      }),
    )
    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'clients',
        id: 'client-1',
        data: { creditBalance: 50 },
        req,
      }),
    )
    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'payments',
        id: 'credit-payment',
        data: expect.objectContaining({
          status: 'voided',
          voidReason: 'Guided payment undone before sample collection',
        }),
        req,
      }),
    )
  })

  test('removes credit created by an undone overpayment', async () => {
    const payload = createPayload({ clientCredit: 30 })

    const result = await reversePostedPayments({
      payload: payload as unknown as Payload,
      clientId: 'client-1',
      reason: 'Mistake',
      payments: [
        {
          id: 'cash-payment',
          amount: 70,
          method: 'cash',
          source: 'guided-workflow',
          status: 'posted',
          creditAmount: 30,
          allocations: [],
        },
      ],
    })

    expect(result.nextCredit).toBe(0)
    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'clients', data: { creditBalance: 0 } }),
    )
  })

  test('refuses to undo credit that has already been spent elsewhere', async () => {
    const payload = createPayload({ clientCredit: 10 })

    await expect(
      reversePostedPayments({
        payload: payload as unknown as Payload,
        clientId: 'client-1',
        reason: 'Mistake',
        payments: [
          {
            id: 'cash-payment',
            amount: 70,
            method: 'cash',
            source: 'guided-workflow',
            status: 'posted',
            creditAmount: 30,
            allocations: [],
          },
        ],
      }),
    ).rejects.toThrow('created credit that has since been used')
    expect(payload.update).not.toHaveBeenCalled()
  })
})
