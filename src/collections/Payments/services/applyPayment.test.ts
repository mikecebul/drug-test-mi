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
    billingResponsibility?: { payer: 'client' | 'referral'; referral?: { relationTo: 'courts'; value: string } }
    payment?: {
      amountDue?: number
      amountPaid?: number
      balanceDue?: number
      status?: 'paid' | 'partial' | 'unpaid' | 'invoiced'
      referralInvoice?: string
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
  test.each(['cash', 'credit'] as const)(
    'reads later pages before allocating %s or adding account credit',
    async (method) => {
      const payload = createMockPayload({ clientCredit: 50 })
      payload.find
        .mockResolvedValueOnce({
          docs: [
            {
              id: 'referral-test',
              billingResponsibility: { payer: 'referral', referral: { relationTo: 'courts', value: 'court-1' } },
              payment: { balanceDue: 80 },
            },
          ],
          hasNextPage: true,
        } as never)
        .mockResolvedValueOnce({
          docs: [
            {
              id: 'client-test',
              billingResponsibility: { payer: 'client' },
              payment: { amountDue: 50, amountPaid: 0, balanceDue: 50 },
            },
          ],
          hasNextPage: false,
        } as never)
      if (method === 'cash')
        await applyIncomingPayment({
          payload: payload as unknown as Payload,
          clientId: 'client-1',
          amount: 50,
          method,
          source: 'manual',
        })
      else
        await applyAvailableClientCredit({ payload: payload as unknown as Payload, clientId: 'client-1', amount: 50 })
      expect(payload.find).toHaveBeenNthCalledWith(2, expect.objectContaining({ page: 2 }))
      expect(payload.update).toHaveBeenCalledWith(
        expect.objectContaining({
          collection: 'drug-tests',
          id: 'client-test',
          data: expect.objectContaining({ payment: expect.objectContaining({ balanceDue: 0 }) }),
        }),
      )
      expect(payload.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ appliedAmount: 50, creditAmount: 0 }) }),
      )
    },
  )
  test.each(['cash', 'credit'] as const)(
    'does not spend %s on referral debt before an invoice exists',
    async (method) => {
      const payload = createMockPayload({
        clientCredit: method === 'credit' ? 50 : 0,
        unpaidTests: [
          {
            id: 'referral-test',
            billingResponsibility: { payer: 'referral', referral: { relationTo: 'courts', value: 'court-1' } },
            payment: { amountDue: 40, amountPaid: 0, balanceDue: 40, status: 'unpaid' },
          },
          {
            id: 'client-exception',
            billingResponsibility: { payer: 'client' },
            payment: { amountDue: 35, amountPaid: 0, balanceDue: 35, status: 'unpaid' },
          },
        ],
      })
      if (method === 'cash')
        await applyIncomingPayment({
          payload: payload as unknown as Payload,
          clientId: 'client-1',
          amount: 50,
          method,
          source: 'test-tracker',
        })
      else
        await applyAvailableClientCredit({ payload: payload as unknown as Payload, clientId: 'client-1', amount: 50 })
      expect(payload.update).not.toHaveBeenCalledWith(
        expect.objectContaining({ collection: 'drug-tests', id: 'referral-test' }),
      )
      expect(payload.update).toHaveBeenCalledWith(
        expect.objectContaining({
          collection: 'drug-tests',
          id: 'client-exception',
          data: { payment: expect.objectContaining({ balanceDue: 0, amountPaid: 35 }) },
        }),
      )
      expect(payload.update).toHaveBeenCalledWith(
        expect.objectContaining({ collection: 'clients', data: { creditBalance: 15 } }),
      )
    },
  )
  test('does not apply client money or credit to tests already billed on a referral invoice', async () => {
    const unpaidTests = [
      {
        id: 'referral-test',
        payment: {
          amountDue: 40,
          amountPaid: 0,
          balanceDue: 40,
          status: 'invoiced' as const,
          referralInvoice: 'invoice-1',
        },
      },
      {
        id: 'client-test',
        payment: { amountDue: 35, amountPaid: 0, balanceDue: 35, status: 'unpaid' as const },
      },
    ]
    const moneyPayload = createMockPayload({ unpaidTests })
    await applyIncomingPayment({
      payload: moneyPayload as unknown as Payload,
      clientId: 'client-1',
      amount: 35,
      method: 'cash',
      source: 'test-tracker',
    })
    expect(moneyPayload.update).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'drug-tests', id: 'client-test' }),
    )
    expect(moneyPayload.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'drug-tests', id: 'referral-test' }),
    )

    const creditPayload = createMockPayload({ clientCredit: 35, unpaidTests })
    await applyAvailableClientCredit({ payload: creditPayload as unknown as Payload, clientId: 'client-1' })
    expect(creditPayload.update).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'drug-tests', id: 'client-test' }),
    )
    expect(creditPayload.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'drug-tests', id: 'referral-test' }),
    )
  })

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
            { drugTest: 'old-test', amount: 40, confirmationAmount: 0 },
            { drugTest: 'new-test', amount: 20, confirmationAmount: 0 },
          ],
        }),
      }),
    )
  })

  test('allocates guided payments to an old balance before reserving the remainder for today', async () => {
    const payload = createMockPayload({
      unpaidTests: [
        {
          id: 'old-test',
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
      amount: 50,
      method: 'cash',
      source: 'guided-workflow',
      relatedBooking: 'booking-1',
      bookingBalanceDue: 35,
      allocationOrder: 'oldest-balance-first',
    })

    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'drug-tests',
        id: 'old-test',
        data: expect.objectContaining({
          payment: expect.objectContaining({
            amountPaid: 35,
            balanceDue: 0,
            status: 'paid',
          }),
        }),
      }),
    )
    expect(payload.create).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'payments',
        data: expect.objectContaining({
          amount: 50,
          appliedAmount: 35,
          reservedForBookingAmount: 15,
          creditAmount: 0,
          allocations: [{ drugTest: 'old-test', amount: 35, confirmationAmount: 0 }],
        }),
      }),
    )
  })

  test('pays multiple prior tests in order before applying anything to today', async () => {
    const payload = createMockPayload({
      unpaidTests: [
        {
          id: 'oldest-test',
          payment: {
            amountDue: 35,
            amountPaid: 0,
            balanceDue: 35,
            status: 'unpaid',
          },
        },
        {
          id: 'second-oldest-test',
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
      amount: 50,
      method: 'cash',
      source: 'guided-workflow',
      relatedBooking: 'booking-1',
      bookingBalanceDue: 35,
      allocationOrder: 'oldest-balance-first',
    })

    expect(payload.update).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        id: 'oldest-test',
        data: expect.objectContaining({ payment: expect.objectContaining({ amountPaid: 35, balanceDue: 0 }) }),
      }),
    )
    expect(payload.update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        id: 'second-oldest-test',
        data: expect.objectContaining({ payment: expect.objectContaining({ amountPaid: 15, balanceDue: 20 }) }),
      }),
    )
    expect(payload.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reservedForBookingAmount: 0,
          appliedAmount: 50,
          creditAmount: 0,
          allocations: [
            { drugTest: 'oldest-test', amount: 35, confirmationAmount: 0 },
            { drugTest: 'second-oldest-test', amount: 15, confirmationAmount: 0 },
          ],
        }),
      }),
    )
  })

  test('stores guided overpayments as credit after old and current balances are covered', async () => {
    const payload = createMockPayload({
      clientCredit: 5,
      unpaidTests: [
        {
          id: 'old-test',
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
      amount: 90,
      method: 'cash',
      source: 'guided-workflow',
      relatedBooking: 'booking-1',
      bookingBalanceDue: 35,
      allocationOrder: 'oldest-balance-first',
    })

    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'clients',
        id: 'client-1',
        data: { creditBalance: 25 },
      }),
    )
    expect(payload.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amount: 90,
          appliedAmount: 35,
          reservedForBookingAmount: 35,
          creditAmount: 20,
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
            { drugTest: 'old-test', amount: 40, confirmationAmount: 0 },
            { drugTest: 'new-test', amount: 10, confirmationAmount: 0 },
          ],
        }),
      }),
    )
  })

  test('applies an explicit credit amount oldest-first and reserves the remainder for a booking', async () => {
    const payload = createMockPayload({
      clientCredit: 60,
      unpaidTests: [
        {
          id: 'old-test',
          payment: {
            amountDue: 35,
            amountPaid: 0,
            balanceDue: 35,
            status: 'unpaid',
          },
        },
      ],
    })

    const result = await applyAvailableClientCredit({
      payload: payload as unknown as Payload,
      clientId: 'client-1',
      amount: 50,
      relatedBooking: 'booking-1',
      bookingBalanceDue: 40,
      allocationOrder: 'oldest-balance-first',
    })

    expect(result).toMatchObject({ usedCredit: 50 })
    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'clients',
        data: { creditBalance: 10 },
      }),
    )
    expect(payload.create).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'payments',
        data: expect.objectContaining({
          relatedBooking: 'booking-1',
          amount: 50,
          appliedAmount: 35,
          reservedForBookingAmount: 15,
          allocations: [{ drugTest: 'old-test', amount: 35, confirmationAmount: 0 }],
        }),
      }),
    )
  })

  test('rejects an explicit credit amount above the current client credit balance', async () => {
    const payload = createMockPayload({ clientCredit: 20 })

    await expect(
      applyAvailableClientCredit({
        payload: payload as unknown as Payload,
        clientId: 'client-1',
        amount: 25,
        relatedBooking: 'booking-1',
        bookingBalanceDue: 40,
      }),
    ).rejects.toThrow('credit balance changed')
    expect(payload.update).not.toHaveBeenCalled()
    expect(payload.create).not.toHaveBeenCalled()
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
