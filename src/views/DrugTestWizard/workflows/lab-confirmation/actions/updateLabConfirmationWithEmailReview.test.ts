import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FormValues } from '../validators'
import { updateLabConfirmationWithEmailReview } from './updateLabConfirmationWithEmailReview'
import { updateLabScreenWithEmailReview } from '../../lab-screen/actions/updateLabScreenWithEmailReview'

const { auth, findByID, create, update, sendEmails } = vi.hoisted(() => ({
  auth: vi.fn(),
  findByID: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  sendEmails: vi.fn(),
}))

vi.mock('payload', () => ({ getPayload: vi.fn(async () => ({ auth, findByID, create, update })) }))
vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('@/views/DrugTestWizard/actions', () => ({ computeTestResultPreview: vi.fn() }))
vi.mock('@/collections/DrugTests/services', () => ({ fetchDocument: vi.fn(), sendEmails, computeFinalStatus: vi.fn() }))

describe('lab wizard submission guards', () => {
  beforeEach(() => vi.resetAllMocks())

  it('requires an admin session before performing database operations', async () => {
    auth.mockResolvedValue({ user: { collection: 'clients' } })
    const denied = { success: false, error: 'Admin access is required.' }
    await expect(updateLabConfirmationWithEmailReview({} as FormValues, undefined)).resolves.toEqual(denied)
    await expect(updateLabScreenWithEmailReview({} as Parameters<typeof updateLabScreenWithEmailReview>[0], undefined))
      .resolves.toEqual(denied)
    expect(findByID).not.toHaveBeenCalled()
    expect(create).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
  })

  it('rejects a report missing a requested result before uploading or emailing', async () => {
    auth.mockResolvedValue({ user: { collection: 'admins' } })
    findByID.mockResolvedValueOnce({
      screeningStatus: 'confirmation-pending',
      confirmationDecision: 'request-confirmation',
      confirmationSubstances: ['fentanyl', 'alcohol'],
    })
    const arrayBuffer = vi.fn()
    const form = {
      matchCollection: { testId: 'test-1' },
      labConfirmationData: { confirmationResults: [{ substance: 'fentanyl', result: 'confirmed-negative' }] },
      upload: { file: { arrayBuffer } },
    } as unknown as FormValues

    await expect(updateLabConfirmationWithEmailReview(form, undefined)).resolves.toEqual({
      success: false,
      error: 'Enter a result for every requested substance before completing confirmation.',
    })
    expect(arrayBuffer).not.toHaveBeenCalled()
    expect(create).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
    expect(sendEmails).not.toHaveBeenCalled()
  })
})
