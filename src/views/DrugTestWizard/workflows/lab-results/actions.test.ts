import { beforeEach, expect, test, vi } from 'vitest'
import { getLabResultsFormOpts } from './model'
const mocks = vi.hoisted(() => ({
  payload: vi.fn(),
  screen: vi.fn(),
  confirmation: vi.fn(),
  auth: vi.fn(),
  find: vi.fn(),
}))
vi.mock('payload', () => ({ getPayload: mocks.payload }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('next/headers', () => ({ headers: vi.fn().mockResolvedValue(new Headers()) }))
vi.mock('../lab-screen/actions/updateLabScreenWithEmailReview', () => ({
  updateLabScreenWithEmailReview: mocks.screen,
}))
vi.mock('../lab-confirmation/actions/updateLabConfirmationWithEmailReview', () => ({
  updateLabConfirmationWithEmailReview: mocks.confirmation,
}))
import { submitLabResults } from './actions'
beforeEach(() => {
  vi.clearAllMocks()
  mocks.payload.mockResolvedValue({ auth: mocks.auth, findByID: mocks.find })
  mocks.auth.mockResolvedValue({ user: { collection: 'admins', id: 'admin-1' } })
  mocks.screen.mockResolvedValue({ success: true, testId: 'test-1' })
  mocks.confirmation.mockResolvedValue({ success: true, testId: 'test-1' })
})
const values = () => {
  const value = getLabResultsFormOpts().defaultValues
  value.upload.file = new File(['PDF'], 'report.pdf', { type: 'application/pdf' })
  value.matchCollection.testId = 'test-1'
  value.results.screeningVerified = true
  return value
}
test('unauthenticated or client accounts cannot invoke either result save', async () => {
  mocks.auth.mockResolvedValue({ user: { collection: 'clients' } })
  expect((await submitLabResults(values())).success).toBe(false)
  expect(mocks.screen).not.toHaveBeenCalled()
  expect(mocks.confirmation).not.toHaveBeenCalled()
})
test('a collection completed while being reviewed cannot be overwritten', async () => {
  mocks.find.mockResolvedValue({ screeningStatus: 'complete', confirmationDecision: 'request-confirmation' })
  expect((await submitLabResults(values())).success).toBe(false)
  expect(mocks.screen).not.toHaveBeenCalled()
  expect(mocks.confirmation).not.toHaveBeenCalled()
})
test('a received confirmation delegates to the confirmation action and preserves identity acknowledgement', async () => {
  mocks.find.mockResolvedValue({
    screeningStatus: 'confirmation-pending',
    confirmationDecision: 'request-confirmation',
  })
  const value = values()
  value.results.mode = 'confirmation'
  value.results.confirmation.confirmationResults = [{ substance: 'fentanyl', result: 'confirmed-negative' }]
  value.matchCollection.clientMismatchConfirmed = true
  value.matchCollection.clientMismatchConfirmationKey = 'checked-identity'
  expect((await submitLabResults(value)).success).toBe(true)
  expect(mocks.screen).not.toHaveBeenCalled()
  expect(mocks.confirmation).toHaveBeenCalledWith(
    expect.objectContaining({ labConfirmationData: value.results.confirmation }),
    undefined,
    { confirmed: true, key: 'checked-identity' },
  )
})
