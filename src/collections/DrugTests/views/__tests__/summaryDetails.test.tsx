import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test, vi } from 'vitest'
import type { DrugTest } from '@/payload-types'
import type { DocumentViewServerProps } from 'payload'
import {
  summaryCharges,
  summaryMedications,
  summaryConfirmationRows,
  summaryConfirmationState,
  summaryPayment,
} from '../summaryDetails'
import DrugTestSummaryView from '../DrugTestSummaryView'
import { DrugTestSummaryContent } from '../DrugTestSummaryContent'

vi.mock('../UpdateConfirmationDecisionDialog', () => ({
  UpdateConfirmationDecisionDialog: () => <button>Update decision</button>,
}))

function record(overrides: Partial<DrugTest> = {}): Partial<DrugTest> {
  return {
    id: 'test',
    relatedClient: 'client',
    testType: '11-panel-lab',
    collectionDate: '2026-01-08T04:11:00Z',
    screeningStatus: 'screened',
    initialScreenResult: 'unexpected-positive',
    detectedSubstances: ['amphetamines', 'buprenorphine'],
    unexpectedPositives: ['amphetamines'],
    expectedPositives: ['buprenorphine'],
    medicationsArrayAtTestTime: [{ medicationName: 'Suboxone', detectedAs: ['buprenorphine'] }],
    confirmationDecision: 'request-confirmation',
    confirmationSubstances: ['amphetamines'],
    confirmationHoldUntil: '2026-11-09T02:16:00Z',
    payment: {
      status: 'partial',
      amountDue: 85,
      amountPaid: 40,
      balanceDue: 45,
      confirmationFeeDue: 45,
      confirmationFeePaid: 0,
    },
    ...overrides,
  }
}
const now = Date.parse('2026-10-10T12:00:00Z')
const state = (doc: Partial<DrugTest>) => summaryConfirmationState(doc, summaryConfirmationRows(doc), now)

describe('summary payment and confirmation states', () => {
  test('itemizes the stored screening fee and multiple confirmations without changing the total', () => {
    const doc = record({
      confirmationSubstances: ['amphetamines', 'cocaine'],
      payment: { status: 'partial', amountDue: 130, amountPaid: 40, balanceDue: 90, confirmationFeeDue: 90 },
    })
    const rows = summaryCharges(doc)
    expect(rows).toEqual([
      { label: 'Screening fee', amount: 40 },
      { label: 'Confirmation', detail: 'amphetamines', amount: 45 },
      { label: 'Confirmation', detail: 'cocaine', amount: 45 },
    ])
    expect(rows.reduce((total, row) => total + (row.amount || 0), 0)).toBe(130)
  })
  test('itemizes instant confirmation at its stored $30 rate and keeps discounts aggregated', () => {
    const doc = record({
      testType: '17-panel-instant',
      confirmationSubstances: ['amphetamines', 'cocaine'],
      payment: { status: 'unpaid', amountDue: 95, amountPaid: 0, confirmationFeeDue: 60 },
    })
    expect(summaryCharges(doc).map((row) => row.amount)).toEqual([35, 30, 30])
    doc.payment!.amountDue = 85
    doc.payment!.confirmationFeeDue = 50
    expect(summaryCharges(doc)).toEqual([
      { label: 'Screening fee', amount: 35 },
      { label: 'Confirmation (2 substances)', amount: 50 },
    ])
  })
  test('does not fabricate a screen charge when confirmation metadata is missing or exceeds the total', () => {
    const missing = record({ payment: { status: 'unpaid', amountDue: 85 } })
    expect(summaryCharges(missing)).toEqual([
      { label: 'Screening fee', amount: null },
      { label: 'Confirmation fee', amount: null },
    ])
    missing.payment!.confirmationFeeDue = 90
    expect(summaryCharges(missing)[0].amount).toBeNull()
  })
  test('groups saved prescription names under their substance and preserves unmapped medications', () => {
    const doc = record({
      medicationsArrayAtTestTime: [
        { medicationName: 'Suboxone', detectedAs: ['buprenorphine'] },
        { medicationName: 'Generic prescription', detectedAs: ['buprenorphine'], required: true },
        { medicationName: 'Other prescription', detectedAs: ['none'] },
      ],
    })
    expect(summaryMedications(doc)).toEqual([
      { substance: 'buprenorphine', names: ['Suboxone', 'Generic prescription'], required: true },
      { substance: 'unmapped', names: ['Other prescription'], required: false },
    ])
  })
  test.each([
    [{ status: 'paid', amountDue: 85, amountPaid: 85, balanceDue: 0 }, 'Paid'],
    [{ status: 'partial', amountDue: 85, amountPaid: 40, balanceDue: 45 }, 'Partial'],
    [{ status: 'unpaid', amountDue: 45, amountPaid: 0, balanceDue: 45 }, 'Unpaid'],
    [{ status: 'invoiced', amountDue: 85, amountPaid: 0, balanceDue: 85 }, 'Billed to referral'],
    [{ status: 'paid', amountDue: 85, amountPaid: 40, balanceDue: 45 }, 'Partial'],
  ] as const)('shows the actual payment balance and status: %s', (payment, expected) => {
    expect(summaryPayment(record({ payment })).label).toBe(expected)
    expect(summaryPayment(record({ payment })).balance).toBe(payment.balanceDue)
  })
  test('does not present missing payment figures as a paid zero balance', () => {
    expect(summaryPayment({})).toMatchObject({ label: 'Not recorded', total: null, paid: null, balance: null })
  })
  test('paying the original screen does not fund its separately unpaid confirmation', () => {
    expect(state(record()).label).toBe('Payment needed')
  })
  test('respects referral billing and an explicit unpaid admin exception', () => {
    expect(state(record({ billingResponsibility: { payer: 'referral' } })).label).toBe('Billed to referral')
    const doc = record()
    doc.payment!.confirmationPaymentBypassed = true
    expect(state(doc).label).toBe('Payment deferred')
    expect(summaryPayment(doc).balance).toBe(45)
  })
  test('funded selection does not claim that a lab order has already been sent', () => {
    const doc = record()
    doc.payment!.confirmationFeePaid = 45
    doc.confirmationRequestedAt = '2026-10-10T00:00:00Z'
    expect(state(doc).label).toBe('Confirmation selected')
  })
  test('shows requested substances with no outcome as pending and preserves partial results', () => {
    const doc = record({
      confirmationSubstances: ['amphetamines', 'cocaine'],
      confirmationResults: [{ substance: 'amphetamines', result: 'confirmed-negative' }],
    })
    expect(summaryConfirmationRows(doc)).toMatchObject([{ label: 'Confirmed negative' }, { label: 'Pending' }])
    expect(state(doc).label).toBe('Partial results')
  })
  test('distinguishes expected and unexpected confirmed positives using the saved medication snapshot', () => {
    const doc = record({
      confirmationSubstances: ['buprenorphine', 'amphetamines'],
      confirmationResults: [
        { substance: 'buprenorphine', result: 'confirmed-positive' },
        { substance: 'amphetamines', result: 'confirmed-positive' },
      ],
    })
    expect(summaryConfirmationRows(doc).map((row) => row.tone)).toEqual(['success', 'destructive'])
    expect(state(doc).label).toBe('Results received')
  })
  test('unknown and conflicting outcomes stay unverified, never negative or complete', () => {
    const unknown = record({
      confirmationResults: [
        { substance: 'amphetamines', result: 'legacy-unknown' },
      ] as unknown as DrugTest['confirmationResults'],
    })
    const conflicting = record({
      confirmationResults: [
        { substance: 'amphetamines', result: 'confirmed-negative' },
        { substance: 'amphetamines', result: 'confirmed-positive' },
      ],
    })
    for (const doc of [unknown, conflicting]) {
      expect(summaryConfirmationRows(doc)[0]).toMatchObject({ label: 'Needs review', tone: 'warning' })
      expect(state(doc).label).toBe('Needs review')
    }
  })
  test('an expired unpaid lab hold is distinct from an instant specimen and received results', () => {
    const expired = record({ confirmationHoldUntil: '2026-09-01T00:00:00Z' })
    expect(state(expired).label).toBe('Lab hold ended')
    expect(state({ ...expired, testType: '17-panel-instant' }).label).toBe('Payment needed')
    expect(
      state({ ...expired, confirmationResults: [{ substance: 'amphetamines', result: 'confirmed-negative' }] }).label,
    ).toBe('Results received')
  })
})

describe('drug test summary content', () => {
  test('does not invent a confirmation price when test type and payment data are missing', () => {
    const html = renderToStaticMarkup(
      <DrugTestSummaryContent test={record({ testType: undefined, payment: undefined })} />,
    )
    expect(html).toContain('Confirmation fee')
    expect(html).toContain('Not recorded')
    expect(html).not.toContain('$45.00')
    expect(html).not.toContain('$30.00')
  })
  test('keeps original screen findings, confirmation outcomes, and historical medications visible together', () => {
    const html = renderToStaticMarkup(
      <DrugTestSummaryContent
        test={record({
          confirmationResults: [{ substance: 'amphetamines', result: 'confirmed-negative', notes: 'Below cutoff' }],
        })}
        screeningReportHref="/screen.pdf"
        confirmationReportHref="/confirmation.pdf"
      />,
    )
    expect(html).toContain('Unexpected positive')
    expect(html).toContain('Confirmed negative')
    expect(html).toContain('Below cutoff')
    expect(html).toContain('Suboxone')
    expect(html).toContain('Jan 7, 2026, 11:11 PM EST')
    expect(html).toContain('href="/screen.pdf"')
    expect(html).toContain('href="/confirmation.pdf"')
    expect(html).not.toContain('Findings Snapshot')
  })
  test('a collected specimen without findings is awaiting results, not negative', () => {
    const html = renderToStaticMarkup(
      <DrugTestSummaryContent test={{ testType: '11-panel-lab', screeningStatus: 'collected' }} />,
    )
    expect(html).toContain('Awaiting screening results')
    expect(html).not.toContain('No substances detected')
    expect(html).not.toContain('test-summary-confirmation')
  })
  test('leads with the medication substance, with the saved name secondary', () => {
    const html = renderToStaticMarkup(<DrugTestSummaryContent test={record()} />)
    const medications = html.split('data-testid="test-summary-medications"')[1]
    expect(medications.indexOf('Buprenorphine')).toBeLessThan(medications.indexOf('Suboxone'))
  })
  test('retains a zero breathalyzer result and renders stored notes as safe text', () => {
    const html = renderToStaticMarkup(
      <DrugTestSummaryContent
        test={record({
          breathalyzerTaken: true,
          breathalyzerResult: 0,
          medicationsAtTestTime: '<script>medication</script>',
          medicationsArrayAtTestTime: [],
        })}
      />,
    )
    expect(html).toContain('0.000')
    expect(html).toContain('&lt;script&gt;medication&lt;/script&gt;')
  })
  test('loads protected reports and client DOB with the caller request and never substitutes current medications', async () => {
    const req = { user: { id: 'admin', collection: 'admins' } }
    const findByID = vi.fn(async ({ collection }) =>
      collection === 'clients'
        ? { dob: '1972-07-06', medications: [{ medicationName: 'Current medication' }] }
        : { filename: 'screen.pdf' },
    )
    const find = vi.fn().mockResolvedValue({ docs: [] })
    const view = await DrugTestSummaryView({
      doc: record({ testDocument: 'report' }),
      payload: { findByID, find, config: { routes: { api: '/api' } } },
      initPageResult: { req },
    } as unknown as DocumentViewServerProps)
    const html = renderToStaticMarkup(view)
    expect(findByID).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'private-media', overrideAccess: false, req }),
    )
    expect(findByID).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'clients', overrideAccess: false, req }),
    )
    expect(html).toContain('07/06/1972')
    expect(html).toContain('/api/private-media/file/screen.pdf')
    expect(html).toContain('Suboxone')
    expect(html).not.toContain('Current medication')
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'payments',
        overrideAccess: false,
        req,
        depth: 0,
        where: { or: [{ relatedDrugTest: { equals: 'test' } }, { 'allocations.drugTest': { equals: 'test' } }] },
      }),
    )
  })
})
