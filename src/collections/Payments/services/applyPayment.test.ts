import { describe, expect, test, vi } from 'vitest'
import type { Payload, PayloadRequest } from 'payload'

import { applyAvailableClientCredit, applyIncomingPayment } from './applyPayment'

function createMockPayload({
  clientCredit = 0,
  unpaidTests = [],
}: {
  clientCredit?: number
  unpaidTests?: Array<{
    id: string
    payment?: {
      amountDue?: number
      amountPaid?: number
      balanceDue?: number
      status?: 'paid' | 'partial' | 'unpaid'
    }
  }>
}) {
  return {
    findByID: vi.fn().mockResolvedValue({
      id: 'client-1',
      creditBalance: clientCredit,
    }),
    find: vi.fn().mockResolvedValue({
      docs: unpaidTests,
    }),
    update: vi.fn().mockImplementation(async ({ collection, data, id }) => ({
      id,
      collection,
      ...data,
    })),
    create: vi.fn().mockImplementation(async ({ collection, data }) => ({
      id: `${collection}-1`,
      collection,
      ...data,
    })),
  }
}

describe('payment allocation service', () => {
  test('applies incoming payments to oldest unpaid drug-test balances first', async () => {
    const payload = createMockPayload({
      unpaidTests: [
        {
          id: 'old-test',
          payment: {
            amountDue: 40,
            amountPaid: 0,
            balanceDue: 40,
            status: 'unpaid',
          },
        },
        {
          id: 'new-test',
          payment: {
            amountDue: 35,
            amountPaid: 0,
            balanceDue: 35,
            status: 'unpaid',
          },
        },
      ],
    })

    await applyIncomingPayment({
      payload: payload as unknown as Payload,
      clientId: 'client-1',
      amount: 60,
      method: 'cash',
      source: 'test-tracker',
      relatedDrugTest: 'new-test',
    })

    expect(payload.find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'drug-tests',
        sort: 'collectionDate',
      }),
    )
    expect(payload.update).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        collection: 'drug-tests',
        id: 'old-test',
        data: expect.objectContaining({
          payment: expect.objectContaining({
            amountPaid: 40,
            balanceDue: 0,
            status: 'paid',
          }),
        }),
      }),
    )
    expect(payload.update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        collection: 'drug-tests',
        id: 'new-test',
        data: expect.objectContaining({
          payment: expect.objectContaining({
            amountPaid: 20,
            balanceDue: 15,
            status: 'partial',
          }),
        }),
      }),
    )
    expect(payload.create).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'payments',
        data: expect.objectContaining({
          amount: 60,
          appliedAmount: 60,
          creditAmount: 0,
          allocations: [
            { drugTest: 'old-test', amount: 40 },
            { drugTest: 'new-test', amount: 20 },
          ],
        }),
      }),
    )
  })

  test('keeps overpayments as client credit after open balances are paid', async () => {
    const payload = createMockPayload({
      clientCredit: 5,
      unpaidTests: [
        {
          id: 'old-test',
          payment: {
            amountDue: 40,
            amountPaid: 0,
            balanceDue: 40,
            status: 'unpaid',
          },
        },
      ],
    })

    await applyIncomingPayment({
      payload: payload as unknown as Payload,
      clientId: 'client-1',
      amount: 75,
      method: 'cash',
      source: 'guided-workflow',
      relatedBooking: 'booking-1',
    })

    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'clients',
        id: 'client-1',
        data: {
          creditBalance: 40,
        },
      }),
    )
    expect(payload.create).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'payments',
        data: expect.objectContaining({
          amount: 75,
          appliedAmount: 40,
          creditAmount: 35,
        }),
      }),
    )
  })

  test('applies stored client credit to unpaid tests and records a credit payment', async () => {
    const payload = createMockPayload({
      clientCredit: 50,
      unpaidTests: [
        {
          id: 'old-test',
          payment: {
            amountDue: 40,
            amountPaid: 0,
            balanceDue: 40,
            status: 'unpaid',
          },
        },
        {
          id: 'new-test',
          payment: {
            amountDue: 35,
            amountPaid: 0,
            balanceDue: 35,
            status: 'unpaid',
          },
        },
      ],
    })

    await applyAvailableClientCredit({
      payload: payload as unknown as Payload,
      clientId: 'client-1',
      relatedDrugTest: 'new-test',
    })

    expect(payload.update).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        collection: 'drug-tests',
        id: 'old-test',
        data: expect.objectContaining({
          payment: expect.objectContaining({
            amountPaid: 40,
            balanceDue: 0,
            method: 'credit',
            status: 'paid',
          }),
        }),
      }),
    )
    expect(payload.update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        collection: 'drug-tests',
        id: 'new-test',
        data: expect.objectContaining({
          payment: expect.objectContaining({
            amountPaid: 10,
            balanceDue: 25,
            method: 'credit',
            status: 'partial',
          }),
        }),
      }),
    )
    expect(payload.update).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        collection: 'clients',
        id: 'client-1',
        data: {
          creditBalance: 0,
        },
      }),
    )
    expect(payload.create).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'payments',
        data: expect.objectContaining({
          amount: 50,
          method: 'credit',
          source: 'credit-application',
          appliedAmount: 50,
          creditAmount: 0,
          allocations: [
            { drugTest: 'old-test', amount: 40 },
            { drugTest: 'new-test', amount: 10 },
          ],
        }),
      }),
    )
  })

  test('threads transaction request through payment allocation operations', async () => {
    const req = { transactionID: 'txn-1' } as Partial<PayloadRequest>
    const payload = createMockPayload({
      unpaidTests: [
        {
          id: 'old-test',
          payment: {
            amountDue: 40,
            amountPaid: 0,
            balanceDue: 40,
            status: 'unpaid',
          },
        },
      ],
    })

    await applyIncomingPayment({
      payload: payload as unknown as Payload,
      clientId: 'client-1',
      amount: 40,
      method: 'cash',
      source: 'test-tracker',
      relatedDrugTest: 'old-test',
      req,
    })

    expect(payload.find).toHaveBeenCalledWith(expect.objectContaining({ req }))
    expect(payload.update).toHaveBeenCalledWith(expect.objectContaining({ collection: 'drug-tests', req }))
    expect(payload.create).toHaveBeenCalledWith(expect.objectContaining({ collection: 'payments', req }))
  })
})
