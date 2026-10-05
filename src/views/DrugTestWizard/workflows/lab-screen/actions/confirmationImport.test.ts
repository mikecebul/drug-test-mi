import { beforeEach, expect, test, vi } from 'vitest'
import type { FormValues } from '../validators'
import type { ExtractedPdfData } from '../../../queries'

const mocks = vi.hoisted(() => ({ getPayload: vi.fn(), updateTest: vi.fn(), arrayBuffer: vi.fn() }))
vi.mock('payload', () => ({ getPayload: mocks.getPayload }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('@/views/DrugTestWizard/actions', () => ({
  updateTestWithScreening: mocks.updateTest,
  computeTestResultPreview: vi.fn(),
}))
vi.mock('@/collections/DrugTests/services', () => ({ fetchDocument: vi.fn(), sendEmails: vi.fn() }))
vi.mock('@/lib/admin-alerts', () => ({ createAdminAlert: vi.fn() }))
import { updateLabScreenAction } from './updateLabScreen'
import { updateLabScreenWithEmailReview } from './updateLabScreenWithEmailReview'

beforeEach(() => vi.clearAllMocks())
test.each([updateLabScreenAction, updateLabScreenWithEmailReview])(
  '%s rejects partial confirmation before uploading, writing or sending',
  async (action) => {
    const form = { upload: { file: { arrayBuffer: mocks.arrayBuffer } } } as unknown as FormValues
    const result = await action(form, { hasConfirmation: true, confirmationComplete: false } as ExtractedPdfData)
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/confirmation.*review/i)
    expect(mocks.getPayload).not.toHaveBeenCalled()
    expect(mocks.updateTest).not.toHaveBeenCalled()
    expect(mocks.arrayBuffer).not.toHaveBeenCalled()
  },
)
test.each([updateLabScreenAction, updateLabScreenWithEmailReview])(
  '%s does not import confirmation-only reports as a new screen',
  async (action) => {
    const form = { upload: { file: { arrayBuffer: mocks.arrayBuffer } } } as unknown as FormValues
    const result = await action(form, {
      hasConfirmation: true,
      confirmationComplete: true,
      reportKind: 'confirmation',
    } as ExtractedPdfData)
    expect(result.success).toBe(false)
    expect(mocks.getPayload).not.toHaveBeenCalled()
    expect(mocks.updateTest).not.toHaveBeenCalled()
    expect(mocks.arrayBuffer).not.toHaveBeenCalled()
  },
)
