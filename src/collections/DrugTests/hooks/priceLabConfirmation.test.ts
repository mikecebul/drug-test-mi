import { describe, expect, it } from 'vitest'
import type { DrugTest } from '@/payload-types'
import { priceLabConfirmation } from './priceLabConfirmation'

const screen = {
  testType: '11-panel-lab',
  screeningStatus: 'screened',
  confirmationDecision: 'pending-decision',
  payment: { status: 'paid', amountDue: 40, amountPaid: 40, balanceDue: 0 },
} as DrugTest
const request: Partial<DrugTest> = {
  confirmationDecision: 'request-confirmation',
  confirmationSubstances: ['fentanyl'],
}

function price(data: Partial<DrugTest>, originalDoc = screen) {
  return priceLabConfirmation({ data, originalDoc, req: { context: {} } } as Parameters<typeof priceLabConfirmation>[0])
}

describe('lab confirmation pricing', () => {
  it('charges for unique selected substances while keeping the screen payment', async () => {
    const doc = await price({ ...request, confirmationSubstances: ['fentanyl', 'alcohol', 'fentanyl'] })
    expect(doc.confirmationSubstances).toEqual(['fentanyl', 'alcohol'])
    expect(doc.payment).toEqual({
      status: 'partial', amountDue: 130, amountPaid: 40, balanceDue: 90, confirmationFeeDue: 90,
    })
  })

  it('keeps a matching prepaid confirmation paid when the substance is selected later', async () => {
    const payment = { status: 'paid', amountDue: 85, amountPaid: 85, balanceDue: 0, confirmationFeeDue: 45 } as const
    expect((await price({ ...request }, { ...screen, payment })).payment).toEqual(payment)
  })

  it('preserves an existing invoice and paid amount', async () => {
    const payment = { ...screen.payment, status: 'invoiced', referralInvoice: 'invoice-1' } as const
    expect((await price({ ...request }, { ...screen, payment })).payment).toEqual({
      ...payment, amountDue: 85, balanceDue: 45, confirmationFeeDue: 45,
    })
  })

  it('leaves completed imports, instant tests, and unchanged legacy requests alone', async () => {
    const imported: Partial<DrugTest> = {
      ...request, confirmationResults: [{ substance: 'fentanyl', result: 'confirmed-negative' }],
    }
    expect(await price(imported)).toEqual(imported)
    expect(await price(request, { ...screen, testType: '17-panel-instant' })).toEqual(request)
    const unchanged = { processNotes: 'Reviewed' }
    expect(await price(unchanged, { ...screen, ...request })).toEqual(unchanged)
  })

  it('does not silently reduce amounts that have already been paid', () => {
    const existing = {
      ...screen,
      confirmationDecision: 'request-confirmation',
      confirmationSubstances: ['fentanyl', 'alcohol'],
      payment: { status: 'paid', amountDue: 130, amountPaid: 130, balanceDue: 0, confirmationFeeDue: 90 },
    } satisfies DrugTest
    expect(() => price({ ...request }, existing)).toThrow(/reconcile the existing confirmation payment/i)
  })
})
