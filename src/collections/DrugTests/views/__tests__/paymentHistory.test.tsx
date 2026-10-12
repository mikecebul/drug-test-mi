import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import type { DrugTest, Payment } from '@/payload-types'
import { testPaymentHistory, hasMissingScreeningPayment } from '../paymentHistory'
import { TestPaymentCard } from '../TestPaymentCard'

const testDoc: Partial<DrugTest> = {
  id: 'test',
  testType: '11-panel-lab',
  payment: {
    status: 'partial',
    amountDue: 85,
    amountPaid: 40,
    balanceDue: 45,
    confirmationFeeDue: 45,
    confirmationFeePaid: 0,
  },
  confirmationSubstances: ['amphetamines'],
}
const records: Partial<Payment>[] = [
  {
    id: 'screen',
    relatedDrugTest: 'test',
    amount: 40,
    status: 'posted',
    method: 'cash',
    postedAt: '2026-10-09T16:00:00Z',
    allocations: [{ drugTest: 'test', amount: 40, confirmationAmount: 0 }],
  },
  {
    id: 'link',
    relatedDrugTest: 'test',
    purpose: 'confirmation',
    amount: 45,
    status: 'pending',
    method: 'stripe',
    createdAt: '2026-10-10T16:00:00Z',
  },
]
describe('test payment history', () => {
  test('shows a pending link separately without counting it as a payment', () => {
    const entries = testPaymentHistory(testDoc, records)
    expect(entries).toHaveLength(2)
    expect(entries[0]).toMatchObject({ label: 'Confirmation payment link', status: 'pending', amount: 45 })
    expect(entries[1]).toMatchObject({ status: 'posted', amount: 40 })
    const html = renderToStaticMarkup(<TestPaymentCard test={testDoc} records={records} />)
    expect(html).toContain('Partial')
    expect(html).toContain('Payments received')
    expect(html).toContain('Awaiting payment')
    expect(html).toContain('Oct 9, 2026')
  })
  test('excludes unrelated debt, retained credit, and reserved booking funds', () => {
    const account: Partial<Payment> = {
      id: 'account',
      relatedDrugTest: 'test',
      amount: 100,
      status: 'posted',
      allocations: [
        { drugTest: 'other', amount: 45 },
        { drugTest: { id: 'test' } as DrugTest, amount: 30, confirmationAmount: 30 },
      ],
      creditAmount: 25,
    }
    expect(
      testPaymentHistory({ ...testDoc, payment: { status: 'partial', amountPaid: 30 } }, [account])[0],
    ).toMatchObject({
      amount: 30,
      label: 'Confirmation payment',
    })
    expect(
      testPaymentHistory({ ...testDoc, payment: undefined }, [
        { ...account, allocations: [{ drugTest: 'other', amount: 100 }] },
      ]),
    ).toEqual([])
    expect(
      testPaymentHistory({ ...testDoc, payment: undefined }, [{ ...account, allocations: [], creditAmount: 100 }]),
    ).toEqual([])
    expect(
      testPaymentHistory({ ...testDoc, payment: undefined }, [
        { ...account, allocations: [], creditAmount: 0, reservedForBookingAmount: 100 },
      ]),
    ).toEqual([])
  })
  test('retains voided and refunded events without treating either as paid', () => {
    const events = records.map(
      (row) => ({ ...row, status: row.id === 'screen' ? 'voided' : 'refunded' }) as Partial<Payment>,
    )
    const entries = testPaymentHistory({ ...testDoc, payment: { status: 'unpaid', amountPaid: 0 } }, events)
    expect(entries.map((row) => row.status)).toEqual(['refunded', 'voided'])
  })
  test('shows earlier snapshot payments without inventing a date or payment method', () => {
    const entry = testPaymentHistory(testDoc, [records[1]])[1]
    expect(entry).toEqual({ id: 'earlier-payment', label: 'Earlier payment', amount: 40, status: 'legacy' })
  })
  test('marks a confirmation-only legacy snapshot incomplete rather than asserting a free screen', () => {
    const legacy: Partial<DrugTest> = {
      ...testDoc,
      payment: { status: 'partial', amountDue: 45, amountPaid: 0, balanceDue: 45, confirmationFeeDue: 45 },
    }
    expect(hasMissingScreeningPayment(legacy, [records[1]])).toBe(true)
    expect(hasMissingScreeningPayment({ ...legacy, sourceBooking: 'booking' }, [])).toBe(false)
    const html = renderToStaticMarkup(<TestPaymentCard test={legacy} records={[records[1]]} />)
    expect(html).toContain('Not recorded')
    expect(html).toContain('Recorded charges')
    expect(html).not.toContain('Screening fee</dt></div><dd class="shrink-0 tabular-nums">$0.00')
  })
  test('does not assign partially paid confirmation funds evenly across substances', () => {
    const html = renderToStaticMarkup(
      <TestPaymentCard
        test={{
          ...testDoc,
          confirmationSubstances: ['amphetamines', 'cocaine'],
          payment: {
            status: 'partial',
            amountDue: 130,
            amountPaid: 85,
            confirmationFeeDue: 90,
            confirmationFeePaid: 45,
            balanceDue: 45,
          },
        }}
        records={[]}
      />,
    )
    expect(html).not.toContain('$22.50 due')
  })
  test('distinguishes inaccessible history from an empty ledger', () => {
    const html = renderToStaticMarkup(<TestPaymentCard test={testDoc} records={null} />)
    expect(html).toContain('Payment history unavailable')
    expect(html).not.toContain('Earlier payment')
  })
})
