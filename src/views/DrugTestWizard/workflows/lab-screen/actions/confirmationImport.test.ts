import { beforeEach, expect, test, vi } from 'vitest'
import { getLabScreenFormOpts } from '../shared-form'
import type { ParsedPDFData } from '../../../types'

const mocks = vi.hoisted(() => ({
  getPayload: vi.fn(),
  updateTest: vi.fn(),
  readReport: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  sendEmails: vi.fn(),
  preview: vi.fn(),
  fetchDocument: vi.fn(),
}))
vi.mock('payload', () => ({ getPayload: mocks.getPayload }))
vi.mock('next/headers', () => ({ headers: async () => new Headers() }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('../../components/readLabReport', () => ({
  readLabReportFile: mocks.readReport,
  verifyLabReportIdentity: vi.fn(),
}))
vi.mock('@/views/DrugTestWizard/actions', () => ({
  updateTestWithScreening: mocks.updateTest,
  computeTestResultPreview: mocks.preview,
}))
vi.mock('@/collections/DrugTests/services', async (original) => ({
  ...(await original<object>()),
  fetchDocument: mocks.fetchDocument,
  sendEmails: mocks.sendEmails,
}))
vi.mock('@/lib/admin-alerts', () => ({ createAdminAlert: vi.fn() }))
import { updateLabScreenAction } from './updateLabScreen'
import { updateLabScreenWithEmailReview } from './updateLabScreenWithEmailReview'
const report = {
  hasConfirmation: true,
  confirmationComplete: false,
  reportKind: 'screening-and-confirmation',
  confirmationResults: [],
  confirmationAnalytes: [{ substance: 'fentanyl', analyte: 'Fentanyl', result: null }],
} as unknown as ParsedPDFData
const form = () => ({
  ...getLabScreenFormOpts().defaultValues,
  upload: { file: new File(['PDF'], 'report.pdf', { type: 'application/pdf' }) },
})
beforeEach(() => {
  vi.clearAllMocks()
  mocks.readReport.mockResolvedValue({ buffer: Buffer.from('PDF'), report })
  mocks.getPayload.mockResolvedValue({
    auth: vi.fn().mockResolvedValue({ user: { id: 'admin', collection: 'admins', role: 'admin' } }),
    findByID: vi.fn(({ collection }) =>
      Promise.resolve(
        collection === 'drug-tests'
          ? {
              relatedClient: 'client-1',
              testType: '11-panel-lab',
              screeningStatus: 'collected',
              confirmationSubstances: [],
              confirmationResults: [],
            }
          : { id: 'client-1' },
      ),
    ),
    create: mocks.create,
    update: mocks.update,
    logger: { error: vi.fn(), info: vi.fn() },
  })
  mocks.updateTest.mockResolvedValue({ success: true })
})
test.each([
  { name: 'screening compatibility action', action: updateLabScreenAction },
  { name: 'screening email action', action: updateLabScreenWithEmailReview },
])(
  '$name rejects an unreviewed combined report before upload, writes or emails, even with falsified cached metadata',
  async ({ action }) => {
    const input = form()
    const result = await action(input, { hasConfirmation: false } as ParsedPDFData)
    expect(result.success).toBe(false)
    expect(mocks.readReport).toHaveBeenCalledWith(input.upload.file)
    expect(mocks.create).not.toHaveBeenCalled()
    expect(mocks.update).not.toHaveBeenCalled()
    expect(mocks.updateTest).not.toHaveBeenCalled()
    expect(mocks.sendEmails).not.toHaveBeenCalled()
  },
)
test.each([
  { name: 'compatibility', action: updateLabScreenAction },
  { name: 'email review', action: updateLabScreenWithEmailReview },
])('$name does not import a confirmation-only report as a new screen', async ({ action }) => {
  mocks.readReport.mockResolvedValue({ buffer: Buffer.from('PDF'), report: { ...report, reportKind: 'confirmation' } })
  const result = await action(form(), undefined)
  expect(result.success).toBe(false)
  expect(result.error).toMatch(/only contains confirmation/)
  expect(mocks.create).not.toHaveBeenCalled()
  expect(mocks.updateTest).not.toHaveBeenCalled()
})
test('a reviewed combined report can use the screening save path without a workflow detour', async () => {
  const input = form()
  input.labScreenData.confirmationResults = [{ substance: 'fentanyl', result: 'confirmed-negative' }]
  const result = await updateLabScreenAction(input, undefined)
  expect(result.success).toBe(true)
  expect(mocks.updateTest).toHaveBeenCalledWith(
    expect.objectContaining({
      hasConfirmation: true,
      confirmationResults: [expect.objectContaining({ substance: 'fentanyl', result: 'confirmed-negative' })],
    }),
  )
})

test('denies an unauthenticated direct save before parsing or any mutation', async () => {
  mocks.getPayload.mockResolvedValue({ auth: vi.fn().mockResolvedValue({ user: null }) })
  const result = await updateLabScreenWithEmailReview(form(), undefined)
  expect(result.success).toBe(false)
  expect(mocks.readReport).not.toHaveBeenCalled()
  expect(mocks.create).not.toHaveBeenCalled()
  expect(mocks.update).not.toHaveBeenCalled()
})

test('combined report delivery includes confirmation results and retains collection notification history', async () => {
  const input = form()
  input.matchCollection.testId = 'test'
  input.matchCollection.clientName = 'Alex Morgan'
  input.labScreenData.detectedSubstances = ['fentanyl']
  input.labScreenData.confirmationResults = [{ substance: 'fentanyl', result: 'confirmed-negative' }]
  const previous = { stage: 'collected', sentAt: '2026-10-01T14:00:00Z', status: 'sent' }
  const payload = await mocks.getPayload()
  payload.findByID.mockImplementation(({ collection }: { collection: string }) =>
    Promise.resolve(
      collection === 'drug-tests'
        ? {
            id: 'test',
            testType: '11-panel-lab',
            screeningStatus: 'collected',
            relatedClient: 'client-1',
            notificationsSent: [previous],
          }
        : { id: 'client-1', firstName: 'Alex', lastName: 'Morgan' },
    ),
  )
  mocks.preview.mockResolvedValue({
    initialScreenResult: 'negative',
    expectedPositives: [],
    unexpectedPositives: [],
    unexpectedNegatives: [],
    autoAccept: true,
  })
  mocks.create.mockResolvedValue({ id: 'report' })
  mocks.update.mockResolvedValue({
    confirmationDecision: 'request-confirmation',
    confirmationResults: input.labScreenData.confirmationResults,
    isComplete: true,
  })
  mocks.fetchDocument.mockResolvedValue({
    filename: 'report.pdf',
    buffer: Buffer.from('PDF'),
    mimeType: 'application/pdf',
  })
  mocks.sendEmails.mockResolvedValue({ sentTo: [], failedRecipients: [] })
  const result = await updateLabScreenWithEmailReview(input, undefined)
  expect(result.success).toBe(true)
  expect(mocks.update).toHaveBeenCalledWith(
    expect.objectContaining({ data: expect.objectContaining({ confirmationDocument: 'report' }) }),
  )
  expect(mocks.sendEmails).toHaveBeenCalledWith(
    expect.objectContaining({
      emailStage: 'complete',
      referralEmailData: expect.objectContaining({ html: expect.stringContaining('Confirmed negative') }),
    }),
  )
  expect(mocks.update).toHaveBeenLastCalledWith(
    expect.objectContaining({
      data: { notificationsSent: [previous, expect.objectContaining({ stage: 'complete' })] },
    }),
  )
})

test('a stale direct screening save cannot replace a completed test', async () => {
  const payload = await mocks.getPayload()
  payload.findByID.mockResolvedValue({
    id: 'test',
    relatedClient: 'client-1',
    testType: '11-panel-lab',
    screeningStatus: 'complete',
  })
  const result = await updateLabScreenWithEmailReview(form(), undefined)
  expect(result.success).toBe(false)
  expect(mocks.create).not.toHaveBeenCalled()
  expect(mocks.readReport).not.toHaveBeenCalled()
  expect(mocks.sendEmails).not.toHaveBeenCalled()
})
