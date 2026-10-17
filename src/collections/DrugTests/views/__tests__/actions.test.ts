import { beforeEach, expect, test, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ auth: vi.fn(), prepare: vi.fn(), revalidate: vi.fn() }))
vi.mock('payload', () => ({ getPayload: async () => ({ auth: mocks.auth }) }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('next/headers', () => ({ headers: async () => new Headers() }))
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidate }))
vi.mock('../../confirmation/prepare', () => ({ prepareConfirmation: mocks.prepare }))
import { updateConfirmationDecision } from '../actions'
const user = { id: 'admin', collection: 'admins', role: 'admin' }
beforeEach(() => {
  vi.clearAllMocks()
  mocks.auth.mockResolvedValue({ user })
  mocks.prepare.mockResolvedValue({})
})
test.each([null, { id: 'client', collection: 'clients' }])('rejects non-admin users %j', async (user) => {
  mocks.auth.mockResolvedValue({ user })
  expect((await updateConfirmationDecision('test', {})).success).toBe(false)
  expect(mocks.prepare).not.toHaveBeenCalled()
})
test('routes a standard admin through the fee/checkout policy without spending credit', async () => {
  expect(
    (
      await updateConfirmationDecision('test', {
        confirmationDecision: 'request-confirmation',
        confirmationSubstances: ['amphetamines'],
      })
    ).success,
  ).toBe(true)
  expect(mocks.prepare).toHaveBeenCalledWith(
    expect.objectContaining({
      user,
      testId: 'test',
      decision: 'request-confirmation',
      substances: ['amphetamines'],
      creditPayment: 'none',
    }),
  )
  expect(mocks.revalidate).toHaveBeenCalledWith('/admin/collections/drug-tests/test/summary')
})
test.each([{ confirmationSubstances: [] }, { confirmationSubstances: ['not-a-substance'] }])(
  'rejects incomplete or invalid requests %j before a write',
  async ({ confirmationSubstances }) => {
    expect(
      (
        await updateConfirmationDecision('test', {
          confirmationDecision: 'request-confirmation',
          confirmationSubstances,
        })
      ).success,
    ).toBe(false)
    expect(mocks.prepare).not.toHaveBeenCalled()
  },
)
test('acceptance removes stale selection through the same policy service', async () => {
  await updateConfirmationDecision('test', { confirmationDecision: 'accept', confirmationSubstances: ['amphetamines'] })
  expect(mocks.prepare).toHaveBeenCalledWith(expect.objectContaining({ decision: 'accept', substances: [] }))
})
test.each(['Confirmation has a payment applied.', 'The 30-day laboratory hold has ended.'])(
  'keeps policy rejection visible: %s',
  async (message) => {
    mocks.prepare.mockRejectedValue(new Error(message))
    expect(
      await updateConfirmationDecision('test', {
        confirmationDecision: 'request-confirmation',
        confirmationSubstances: ['amphetamines'],
      }),
    ).toMatchObject({ success: false, error: message })
    expect(mocks.revalidate).not.toHaveBeenCalled()
  },
)
