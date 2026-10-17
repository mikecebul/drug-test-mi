import { beforeEach, expect, test, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ auth: vi.fn(), read: vi.fn(), write: vi.fn() }))
vi.mock('payload', () => ({
  getPayload: async () => ({ auth: mocks.auth, findByID: mocks.read, create: mocks.write, update: mocks.write }),
}))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('next/headers', () => ({ headers: async () => new Headers() }))
import {
  extractPdfData,
  computeTestResultPreview,
  getEmailPreview,
  getCollectionEmailPreview,
  getConfirmationEmailPreview,
  registerClientFromWizard,
  updateTestWithScreening,
} from '../actions'
import { createCollectionWithEmailReview } from '../workflows/collect-lab/actions/createCollectionWithEmailReview'
import { createInstantTest } from '../workflows/instant-test/actions/createInstantTest'
import { createDrugTestWithEmailReview } from '../workflows/instant-test/actions/createDrugTestWithEmailReview'
import { registerClientAction } from '../workflows/register-client-workflow/actions/registerClientAction'

const actions = [
  { name: 'PDF extraction', call: () => extractPdfData(new FormData()) },
  { name: 'medication classification', call: () => computeTestResultPreview('client', [], '17-panel-instant') },
  { name: 'screening preview', call: () => getEmailPreview({} as never) },
  { name: 'collection preview', call: () => getCollectionEmailPreview({} as never) },
  { name: 'confirmation preview', call: () => getConfirmationEmailPreview({} as never) },
  { name: 'inline registration', call: () => registerClientFromWizard({} as never) },
  { name: 'screening compatibility save', call: () => updateTestWithScreening({} as never) },
  { name: 'collection save', call: () => createCollectionWithEmailReview({} as never, [], {} as never) },
  { name: 'instant save', call: () => createInstantTest({} as never, [], {} as never) },
  { name: 'instant email save', call: () => createDrugTestWithEmailReview({} as never, [], {} as never) },
  { name: 'registration workflow', call: () => registerClientAction({} as never) },
]
beforeEach(() => vi.clearAllMocks())
test.each(actions)('$name denies unauthenticated requests before reading or changing clinic data', async ({ call }) => {
  mocks.auth.mockResolvedValue({ user: null })
  await expect(call()).rejects.toThrow('Admin access required')
  expect(mocks.read).not.toHaveBeenCalled()
  expect(mocks.write).not.toHaveBeenCalled()
})
test.each(actions)('$name denies client accounts before reading or changing clinic data', async ({ call }) => {
  mocks.auth.mockResolvedValue({ user: { id: 'client', collection: 'clients' } })
  await expect(call()).rejects.toThrow('Admin access required')
  expect(mocks.read).not.toHaveBeenCalled()
  expect(mocks.write).not.toHaveBeenCalled()
})
