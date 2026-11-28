import type { Payload, PayloadRequest } from 'payload'
import type { DrugTest } from '@/payload-types'
import { describe, expect, it, vi } from 'vitest'
import { queuePaidRedwoodConfirmation, sendPaidRedwoodConfirmation } from './order'

const paidTest = {
  id: 'lab-test',
  relatedClient: 'client',
  accessionNumber: 'AB123456',
  redwoodReportAccountNumber: '310872',
  collectionDate: '2026-11-07T03:30:00.000Z',
  confirmationDecision: 'request-confirmation',
  confirmationSubstances: ['fentanyl', 'alcohol'],
  testType: '11-panel-lab',
  payment: { status: 'paid', amountDue: 130, amountPaid: 130, confirmationFeeDue: 90 },
} as DrugTest
const unpaidTest: DrugTest = { ...paidTest, payment: { ...paidTest.payment, status: 'partial', amountPaid: 40 } }

function setup() {
  const queue = vi.fn()
  const sendEmail = vi.fn()
  const update = vi.fn()
  const create = vi.fn()
  const findByID = vi.fn(async ({ collection }) =>
    collection === 'clients' ? { firstName: 'Example', lastName: 'Client' } : paidTest,
  )
  const payload = { jobs: { queue }, sendEmail, update, findByID, create, logger: { info: vi.fn() } } as unknown as Payload
  const req = { payload } as PayloadRequest
  const queueFor = (doc: DrugTest, previousDoc: DrugTest) =>
    queuePaidRedwoodConfirmation({ doc, previousDoc, req } as Parameters<typeof queuePaidRedwoodConfirmation>[0])
  return { req, queue, sendEmail, update, findByID, create, queueFor }
}

describe('paid Redwood confirmation orders', () => {
  it('queues when the fee becomes paid and emails the stored accession and selected substances', async () => {
    const { req, queue, sendEmail, update, queueFor } = setup()
    await queueFor(paidTest, unpaidTest)
    await queueFor(paidTest, paidTest)
    expect(queue).toHaveBeenCalledTimes(1)
    const [{ input }] = queue.mock.calls[0]
    await sendPaidRedwoodConfirmation(req, paidTest.id, input.orderKey, new Date().toISOString())
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      from: 'Mike Cebulski <mike@midrugtest.com>',
      subject: expect.stringContaining('Agency 310872 - Confirmation request'),
      text: expect.stringContaining('confirmation of fentanyl and alcohol for Example Client.'),
    }))
    expect(sendEmail.mock.calls[0][0].text).toContain('Accession #: AB123456\nCollected: November 6, 2026')
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      id: paidTest.id, data: expect.objectContaining({ redwoodConfirmationSentAt: expect.any(String) }),
    }))
  })

  it('does not queue for missing accessions, unselected substances, partial payment, or completed orders', async () => {
    const { queue, queueFor } = setup()
    for (const invalid of [
      { accessionNumber: null },
      { confirmationDecision: 'pending-decision' },
      { confirmationSubstances: [] },
      { payment: { ...paidTest.payment, amountPaid: 40 } },
      { payment: { ...paidTest.payment, confirmationFeeDue: 45 } },
      { redwoodConfirmationSentAt: '2026-11-07T18:30:00.000Z' },
    ]) {
      await queueFor({ ...paidTest, ...invalid } as DrugTest, unpaidTest)
    }
    expect(queue).not.toHaveBeenCalled()
  })

  it('alerts once when a paid request needs the accession and queues when it is supplied', async () => {
    const { req, queue, create, queueFor } = setup()
    const missingAccession = { ...paidTest, accessionNumber: null }
    await queueFor(missingAccession, unpaidTest)
    await queueFor(missingAccession, missingAccession)
    expect(queue).not.toHaveBeenCalled()
    expect(create).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      collection: 'admin-alerts',
      data: expect.objectContaining({
        alertType: 'document-missing',
        context: { drugTestId: paidTest.id },
      }),
      req,
    }))

    await queueFor(paidTest, missingAccession)
    expect(queue).toHaveBeenCalledTimes(1)
  })

  it.each([null, '310974'])('requires a verified account before queuing or sending (%s)', async (account) => {
    const { req, queue, create, sendEmail, findByID, queueFor } = setup()
    const unverified = { ...paidTest, redwoodReportAccountNumber: account }
    await queueFor(unverified, unpaidTest)
    await queueFor(unverified, unverified)
    expect(queue).not.toHaveBeenCalled()
    expect(create).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      collection: 'admin-alerts',
      data: expect.objectContaining({ alertType: 'data-integrity' }),
    }))

    await queueFor(paidTest, unverified)
    const [{ input }] = queue.mock.calls[0]
    findByID.mockResolvedValueOnce(unverified)
    await expect(sendPaidRedwoodConfirmation(req, paidTest.id, input.orderKey, new Date().toISOString()))
      .resolves.toEqual({ status: 'skipped' })
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('skips an already queued email when the order is held and queues again on release', async () => {
    const { req, queue, sendEmail, findByID, queueFor } = setup()
    const held = { ...paidTest, redwoodConfirmationEmailOnHold: true }
    await queueFor(held, unpaidTest)
    expect(queue).not.toHaveBeenCalled()

    await queueFor(paidTest, held)
    const [{ input }] = queue.mock.calls[0]
    findByID.mockResolvedValueOnce(held)
    await expect(sendPaidRedwoodConfirmation(req, paidTest.id, input.orderKey, new Date().toISOString()))
      .resolves.toEqual({ status: 'skipped' })
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('rechecks the order before sending if payment or selections have changed', async () => {
    const { req, queue, sendEmail, findByID, queueFor } = setup()
    await queueFor(paidTest, unpaidTest)
    const [{ input }] = queue.mock.calls[0]
    findByID.mockResolvedValueOnce({ ...paidTest, payment: { ...paidTest.payment, amountPaid: 40 } })
    await expect(sendPaidRedwoodConfirmation(req, paidTest.id, input.orderKey, new Date().toISOString()))
      .resolves.toEqual({ status: 'skipped' })
    expect(sendEmail).not.toHaveBeenCalled()
  })
})
