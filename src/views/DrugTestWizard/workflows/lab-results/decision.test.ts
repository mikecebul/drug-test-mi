import { beforeEach, expect, test, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ auth: vi.fn(), prepare: vi.fn(), send: vi.fn(), read: vi.fn(), classify: vi.fn() }))
vi.mock('next/headers', () => ({ headers: async () => new Headers() }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', () => ({
  getPayload: async () => ({
    auth: mocks.auth,
    findByID: async ({ collection }: { collection: string }) =>
      collection === 'drug-tests'
        ? {
            id: 'test',
            relatedClient: 'client',
            testType: '11-panel-lab',
            screeningStatus: 'collected',
            screenedAt: '2026-10-07T00:00:00Z',
            confirmationHoldUntil: '2026-11-06T00:00:00Z',
            payment: { confirmationFeeDue: 45, confirmationFeePaid: 0 },
          }
        : { id: 'client' },
  }),
}))
vi.mock('../lab-screen/actions/updateLabScreenWithEmailReview', () => ({ updateLabScreenWithEmailReview: vi.fn() }))
vi.mock('../lab-confirmation/actions/updateLabConfirmationWithEmailReview', () => ({
  updateLabConfirmationWithEmailReview: vi.fn(),
}))
vi.mock('../components/readLabReport', () => ({ readLabReportFile: mocks.read, verifyLabReportIdentity: vi.fn() }))
vi.mock('@/collections/DrugTests/services/testResults', () => ({ computeTestResults: mocks.classify }))
vi.mock('@/collections/DrugTests/confirmation/prepare', () => ({ prepareConfirmation: mocks.prepare }))
vi.mock('@/collections/DrugTests/confirmation/paymentLink', () => ({ sendConfirmationPaymentLink: mocks.send }))
import { getLabResultsFormOpts } from './model'
import { prepareLabResultDecision } from './actions'
function values(email = true) {
  const data = getLabResultsFormOpts().defaultValues
  data.upload.file = new File(['PDF'], 'lab.pdf', { type: 'application/pdf' })
  data.matchCollection.testId = 'test'
  data.results.screeningVerified = true
  data.results.screening.confirmationDecision = 'request-confirmation'
  data.results.screening.confirmationSubstances = ['fentanyl']
  data.results.emailConfirmationPaymentLink = email
  return data
}
beforeEach(() => {
  vi.clearAllMocks()
  mocks.auth.mockResolvedValue({ user: { id: 'tech', collection: 'admins', role: 'admin' } })
  mocks.read.mockResolvedValue({ report: { reportKind: 'screening', hasConfirmation: false } })
  mocks.classify.mockResolvedValue({ autoAccept: false })
  mocks.prepare.mockResolvedValue(undefined)
  mocks.send.mockResolvedValue({ sent: true })
})
test('Next sends the selected email and succeeds while the confirmation fee is still unpaid', async () => {
  const result = await prepareLabResultDecision(values())
  expect(result.success).toBe(true)
  expect(result.prepared?.paymentRequired).toBe(true)
  expect(mocks.prepare).toHaveBeenCalledOnce()
  expect(mocks.send).toHaveBeenCalledOnce()
})
test('the payment email is optional and final-save preparation does not send it a second time', async () => {
  await prepareLabResultDecision(values(false))
  await prepareLabResultDecision(values(true), false)
  expect(mocks.send).not.toHaveBeenCalled()
})
test('actual confirmation-only bytes and unauthenticated calls cannot prepare a fee or send an email', async () => {
  mocks.read.mockResolvedValue({ report: { reportKind: 'confirmation' } })
  expect((await prepareLabResultDecision(values())).success).toBe(false)
  mocks.auth.mockResolvedValue({ user: null })
  expect((await prepareLabResultDecision(values())).success).toBe(false)
  expect(mocks.prepare).not.toHaveBeenCalled()
  expect(mocks.send).not.toHaveBeenCalled()
})
