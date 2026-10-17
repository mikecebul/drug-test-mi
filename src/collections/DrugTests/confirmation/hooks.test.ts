import { describe, expect, test, vi } from 'vitest'
import { captureConfirmationState, queueConfirmationPaidNotification } from './hooks'
const run = (data: object, originalDoc: object = {}, context: object = {}) =>
  captureConfirmationState({ data, originalDoc, req: { context } } as never)
describe('confirmation funding hooks', () => {
  test('edits never reset the screening result date or hold', async () => {
    const result = await run({ screenedAt: '2026-10-07T00:00:00Z' }, { screenedAt: '2026-09-07T00:00:00Z' })
    expect(result).toMatchObject({
      screenedAt: '2026-09-07T00:00:00Z',
      confirmationHoldUntil: '2026-10-07T00:00:00.000Z',
    })
  })
  test('partial funding does not queue; full funding queues once in the financial transaction', async () => {
    const originalDoc = {
      confirmationDecision: 'request-confirmation',
      payment: { confirmationFeeDue: 45, confirmationFeePaid: 20 },
    }
    expect(
      await run({ ...originalDoc, payment: { ...originalDoc.payment, confirmationFeePaid: 20 } }, originalDoc, {
        confirmationAllocation: true,
      }),
    ).toMatchObject({ confirmationPaidNotificationKey: null })
    const funded = await run(
      { ...originalDoc, payment: { ...originalDoc.payment, confirmationFeePaid: 45 } },
      originalDoc,
      { confirmationAllocation: true },
    )
    const queue = vi.fn()
    const req = { transactionID: 'financial-txn', payload: { jobs: { queue } } }
    await queueConfirmationPaidNotification({
      doc: { ...funded, id: 'test', confirmationRequestKey: 'request', confirmationNotificationAdmin: 'owner' },
      previousDoc: originalDoc,
      req,
    } as never)
    expect(queue).toHaveBeenCalledWith(
      expect.objectContaining({
        req,
        input: { testId: 'test', notificationKey: funded!.confirmationPaidNotificationKey },
      }),
    )
    await queueConfirmationPaidNotification({ doc: { ...funded, id: 'test' }, previousDoc: funded, req } as never)
    expect(queue).toHaveBeenCalledTimes(1)
  })
  test('referral billing needs no client paid notification', async () => {
    expect(
      await run(
        {
          confirmationDecision: 'request-confirmation',
          billingResponsibility: { payer: 'referral' },
          payment: { confirmationFeeDue: 45, confirmationFeePaid: 45 },
        },
        {},
        { confirmationAllocation: true },
      ),
    ).toMatchObject({ confirmationPaidNotificationKey: null })
  })
})
