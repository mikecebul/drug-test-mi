import { describe, expect, test, vi } from 'vitest'
import type { Payload } from 'payload'
const alert = vi.hoisted(() => vi.fn())
vi.mock('@/lib/admin-alerts', () => ({ createAdminAlert: alert }))
import { notifyConfirmationPaidTask, sendConfirmationPaidNotification } from './notification'
function setup() {
  let record: Record<string, unknown> = {
    id: 'test',
    confirmationPaidNotificationKey: 'paid-key',
    confirmationNotificationAdmin: 'owner',
    relatedClient: { firstName: 'Alex', lastName: 'Taylor' },
    confirmationHoldUntil: new Date(Date.now() + 86400000).toISOString(),
    payment: { confirmationFeeDue: 45, confirmationFeePaid: 45 },
  }
  const payload = {
    findByID: vi.fn(async ({ collection }: { collection: string }) =>
      collection === 'admins' ? { role: 'superAdmin', email: 'owner@example.com' } : record,
    ),
    sendEmail: vi.fn().mockResolvedValue(undefined),
    update: vi.fn(async ({ data }: { data: object }) => {
      record = { ...record, ...data }
      return record
    }),
  }
  return {
    payload,
    run: (key = 'paid-key') => sendConfirmationPaidNotification(payload as unknown as Payload, 'test', key),
  }
}
describe('confirmation paid outbox delivery', () => {
  test('notifies the captured super-admin account once after payment, without claiming a lab order was sent', async () => {
    vi.stubEnv('NEXT_PUBLIC_IS_LIVE', 'true')
    vi.stubEnv('EMAIL_TEST_MODE', 'false')
    const { payload, run } = setup()
    await run()
    await run()
    expect(payload.sendEmail).toHaveBeenCalledTimes(1)
    expect(payload.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ['owner@example.com'],
        html: expect.stringContaining('/admin/collections/drug-tests/test/summary'),
      }),
    )
  })
  test('a failed send is retriable and stale funding notifications do not send', async () => {
    const { payload, run } = setup()
    await run('old-request-key')
    expect(payload.sendEmail).not.toHaveBeenCalled()
    payload.sendEmail.mockRejectedValueOnce(new Error('SMTP unavailable'))
    await expect(run()).rejects.toThrow('SMTP unavailable')
    expect(payload.update).not.toHaveBeenCalled()
    await run()
    expect(payload.update).toHaveBeenCalledTimes(1)
  })
})

test('exhausted email retries create an actionable admin alert without losing the posted payment', async () => {
  alert.mockClear()
  const args = { req: { payload: {} }, job: { id: 'job' }, input: { testId: 'test' }, taskStatus: { totalTried: 2 } }
  await notifyConfirmationPaidTask.onFail!(args as never)
  expect(alert).not.toHaveBeenCalled()
  await notifyConfirmationPaidTask.onFail!({ ...args, taskStatus: { totalTried: 3 } } as never)
  expect(alert).toHaveBeenCalledWith(
    args.req.payload,
    expect.objectContaining({
      alertType: 'email-failure',
      context: expect.objectContaining({ jobId: 'job', testId: 'test' }),
    }),
  )
})
