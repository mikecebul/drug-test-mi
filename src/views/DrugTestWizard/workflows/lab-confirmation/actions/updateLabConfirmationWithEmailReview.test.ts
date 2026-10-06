import { beforeEach, expect, test, vi } from 'vitest'
import { getLabConfirmationFormOpts } from '../shared-form'
const mocks = vi.hoisted(() => ({
  getPayload: vi.fn(),
  readReport: vi.fn(),
  find: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  send: vi.fn(),
  build: vi.fn(),
}))
vi.mock('payload', () => ({ getPayload: mocks.getPayload }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('../../components/readLabReport', () => ({
  readLabReportFile: mocks.readReport,
  verifyLabReportIdentity: vi.fn(),
}))
vi.mock('@/views/DrugTestWizard/actions', () => ({
  computeTestResultPreview: vi.fn().mockResolvedValue({
    initialScreenResult: 'negative',
    expectedPositives: [],
    unexpectedPositives: [],
    unexpectedNegatives: [],
  }),
}))
vi.mock('@/collections/DrugTests/services', () => ({
  fetchDocument: vi
    .fn()
    .mockResolvedValue({ filename: 'report.pdf', buffer: Buffer.from('PDF'), mimeType: 'application/pdf' }),
  sendEmails: mocks.send,
  computeFinalStatus: vi.fn().mockReturnValue('confirmed-negative'),
}))
vi.mock('@/collections/DrugTests/email/render', () => ({ buildCompleteEmail: mocks.build }))
vi.mock('@/collections/DrugTests/email/fetch-headshot', () => ({
  fetchClientHeadshot: vi.fn().mockResolvedValue(null),
}))
vi.mock('@/lib/admin-alerts', () => ({ createAdminAlert: vi.fn() }))
import { updateLabConfirmationWithEmailReview } from './updateLabConfirmationWithEmailReview'
const current = () => ({
  id: 'test-1',
  relatedClient: 'client-1',
  screeningStatus: 'confirmation-pending',
  testType: '11-panel-lab',
  detectedSubstances: ['fentanyl', 'thc'],
  confirmationSubstances: ['fentanyl', 'thc'],
  confirmationResults: [],
  notificationsSent: [],
})
const form = () => {
  const input = structuredClone(getLabConfirmationFormOpts().defaultValues)
  input.upload.file = new File(['PDF'], 'report.pdf', { type: 'application/pdf' })
  input.matchCollection = {
    ...input.matchCollection,
    testId: 'test-1',
    clientName: 'Sample Q Donor',
    collectionDate: '2025-11-19T23:17:00Z',
    testType: '11-panel-lab',
  }
  return input
}
beforeEach(() => {
  vi.clearAllMocks()
  mocks.find.mockImplementation(({ collection }) =>
    Promise.resolve(
      collection === 'drug-tests' ? current() : { id: 'client-1', firstName: 'Sample', lastName: 'Donor' },
    ),
  )
  mocks.getPayload.mockResolvedValue({
    findByID: mocks.find,
    create: mocks.create,
    update: mocks.update,
    logger: { info: vi.fn(), error: vi.fn() },
  })
  mocks.create.mockResolvedValue({ id: 'pdf-1' })
  mocks.send.mockResolvedValue({ sentTo: [], failedRecipients: [] })
  mocks.build.mockResolvedValue({ client: {}, referrals: {} })
  mocks.readReport.mockResolvedValue({
    buffer: Buffer.from('PDF'),
    report: {
      hasConfirmation: true,
      confirmationComplete: false,
      confirmationResults: [{ substance: 'fentanyl', result: 'confirmed-negative' }],
      confirmationAnalytes: [{ analyte: 'THC', substance: 'thc', result: null }],
    },
  })
})
test('rejects a parsed subset against the original request before any side effect', async () => {
  const input = form()
  input.labConfirmationData.confirmationResults = [{ substance: 'fentanyl', result: 'confirmed-negative' }]
  const result = await updateLabConfirmationWithEmailReview(input, undefined)
  expect(result.success).toBe(false)
  expect(result.error).toMatch(/every requested/)
  expect(mocks.create).not.toHaveBeenCalled()
  expect(mocks.update).not.toHaveBeenCalled()
  expect(mocks.send).not.toHaveBeenCalled()
})
test('saves explicit corrections without shrinking the original request', async () => {
  const input = form()
  input.labConfirmationData.confirmationResults = [
    { substance: 'fentanyl', result: 'confirmed-negative' },
    { substance: 'thc', result: 'confirmed-negative' },
  ]
  const result = await updateLabConfirmationWithEmailReview(input, undefined)
  expect(result.success).toBe(true)
  expect(mocks.update).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        confirmationSubstances: ['fentanyl', 'thc'],
        confirmationResults: expect.arrayContaining([
          expect.objectContaining({ substance: 'thc', result: 'confirmed-negative' }),
        ]),
      }),
    }),
  )
})
test('retains an earlier received result when a later report completes the request', async () => {
  const earlier = { ...current(), confirmationResults: [{ substance: 'fentanyl', result: 'confirmed-negative' }] }
  mocks.find.mockImplementation(({ collection }) =>
    Promise.resolve(collection === 'drug-tests' ? earlier : { id: 'client-1', firstName: 'Sample', lastName: 'Donor' }),
  )
  mocks.readReport.mockResolvedValue({
    buffer: Buffer.from('PDF'),
    report: {
      hasConfirmation: true,
      confirmationComplete: true,
      confirmationResults: [{ substance: 'thc', result: 'confirmed-negative' }],
    },
  })
  const input = form()
  input.labConfirmationData.confirmationResults = [{ substance: 'thc', result: 'confirmed-negative' }]
  expect((await updateLabConfirmationWithEmailReview(input, undefined)).success).toBe(true)
  expect(mocks.update).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        confirmationSubstances: ['fentanyl', 'thc'],
        confirmationResults: expect.arrayContaining([
          expect.objectContaining({ substance: 'fentanyl', result: 'confirmed-negative' }),
          expect.objectContaining({ substance: 'thc', result: 'confirmed-negative' }),
        ]),
      }),
    }),
  )
})
