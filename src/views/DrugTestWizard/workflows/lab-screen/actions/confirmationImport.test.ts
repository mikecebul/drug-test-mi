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
}))
vi.mock('payload', () => ({ getPayload: mocks.getPayload }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('../../components/readLabReport', () => ({
  readLabReportFile: mocks.readReport,
  verifyLabReportIdentity: vi.fn(),
}))
vi.mock('@/views/DrugTestWizard/actions', () => ({
  updateTestWithScreening: mocks.updateTest,
  computeTestResultPreview: vi.fn(),
}))
vi.mock('@/collections/DrugTests/services', () => ({ fetchDocument: vi.fn(), sendEmails: mocks.sendEmails }))
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
    findByID: vi.fn(({ collection }) =>
      Promise.resolve(
        collection === 'drug-tests'
          ? { relatedClient: 'client-1', confirmationSubstances: [], confirmationResults: [] }
          : { id: 'client-1' },
      ),
    ),
    create: mocks.create,
    update: mocks.update,
    logger: { error: vi.fn() },
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
