import { beforeEach, expect, test, vi } from 'vitest'
const mocks = vi.hoisted(() => ({
  find: vi.fn(),
  recipients: vi.fn(),
  preview: vi.fn(),
  complete: vi.fn(),
  screen: vi.fn(),
}))
vi.mock('payload', () => ({
  getPayload: async () => ({
    auth: async () => ({ user: { id: 'admin', collection: 'admins' } }),
    findByID: mocks.find,
    logger: { error: vi.fn() },
  }),
}))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('next/headers', () => ({ headers: async () => new Headers() }))
vi.mock('@/collections/DrugTests/email/recipients', () => ({ getRecipients: mocks.recipients }))
vi.mock('@/collections/DrugTests/email/fetch-headshot', () => ({ fetchClientHeadshot: async () => null }))
vi.mock('@/collections/DrugTests/email/render', () => ({
  buildCompleteEmail: mocks.complete,
  buildScreenedEmail: mocks.screen,
}))
vi.mock('./computeTestResultPreview', () => ({ computeTestResultPreview: mocks.preview }))
import { getEmailPreview, getConfirmationEmailPreview } from './emailPreviews'
const snapshot = [
  {
    medicationName: 'At collection',
    detectedAs: ['buprenorphine' as const],
    required: true,
    startDate: '2025-01-01',
    status: 'active' as const,
  },
]
beforeEach(() => {
  vi.clearAllMocks()
  mocks.find.mockImplementation(({ collection }) =>
    Promise.resolve(
      collection === 'clients'
        ? { id: 'client', firstName: 'Alex', lastName: 'Morgan' }
        : {
            relatedClient: { id: 'client', firstName: 'Alex', lastName: 'Morgan' },
            testType: '11-panel-lab',
            collectionDate: '2026-10-09T14:00:00Z',
            medicationsArrayAtTestTime: snapshot,
            breathalyzerTaken: true,
            breathalyzerResult: 0,
          },
    ),
  )
  mocks.recipients.mockResolvedValue({ clientEmail: 'client@example.com', referralEmails: ['referral@example.com'] })
  mocks.preview.mockResolvedValue({
    initialScreenResult: 'negative',
    expectedPositives: [],
    unexpectedPositives: [],
    unexpectedNegatives: [],
  })
  const rendered = {
    client: { subject: 'Results', html: '<p>Shared</p>' },
    referrals: { subject: 'Results', html: '<p>Shared</p>' },
  }
  mocks.complete.mockResolvedValue(rendered)
  mocks.screen.mockResolvedValue(rendered)
})
test('a combined report previews its final confirmation outcomes, matching delivery', async () => {
  const confirmationResults = [{ substance: 'amphetamines', result: 'confirmed-negative' as const }]
  const result = await getEmailPreview({
    clientId: 'client',
    testType: '11-panel-lab',
    collectionDate: '2026-10-09T14:00:00Z',
    detectedSubstances: ['amphetamines'],
    isDilute: false,
    medications: snapshot,
    confirmationResults,
  })
  expect(result.success).toBe(true)
  expect(mocks.preview).toHaveBeenCalledWith('client', [], '11-panel-lab', undefined, undefined, snapshot)
  expect(mocks.complete).toHaveBeenCalledWith(
    expect.objectContaining({ confirmationResults, detectedSubstances: [], finalStatus: 'confirmed-negative' }),
  )
  expect(mocks.screen).not.toHaveBeenCalled()
})
test('confirmation previews classify against the historical medication/PBT snapshot', async () => {
  const result = await getConfirmationEmailPreview({
    clientId: 'client',
    testId: 'test',
    adjustedSubstances: [],
    confirmationResults: [{ substance: 'amphetamines', result: 'confirmed-negative' }],
  })
  expect(result.success).toBe(true)
  expect(mocks.preview).toHaveBeenCalledWith('client', [], '11-panel-lab', true, 0, snapshot)
})
test('a mismatched client ID cannot mix one client’s recipients with another client’s result', async () => {
  const result = await getConfirmationEmailPreview({
    clientId: 'other-client',
    testId: 'test',
    confirmationResults: [],
  })
  expect(result.success).toBe(false)
  expect(mocks.recipients).not.toHaveBeenCalled()
  expect(mocks.complete).not.toHaveBeenCalled()
})
