import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getPayload } from 'payload'
import { queueRedwoodImportForClient } from '@/lib/redwood/queue'
import { registerClientAction } from '@/views/DrugTestWizard/workflows/register-client-workflow/actions/registerClientAction'

vi.mock('payload', () => ({
  getPayload: vi.fn(),
}))

vi.mock('@payload-config', () => ({
  default: {},
}))

vi.mock('@/lib/redwood/queue', () => ({
  queueRedwoodImportForClient: vi.fn(),
}))

describe('registerClientAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('queues redwood import after successful admin registration', async () => {
    const payloadMock: any = {
      find: vi.fn().mockResolvedValue({ docs: [] }),
      create: vi.fn().mockResolvedValue({ id: 'client-admin-1', email: 'admin@example.com' }),
      logger: {
        info: vi.fn(),
        error: vi.fn(),
      },
    }

    vi.mocked(getPayload).mockResolvedValue(payloadMock)

    const result = await registerClientAction({
      personalInfo: {
        firstName: 'Jamie',
        middleInitial: 'R',
        lastName: 'Stone',
        gender: 'female',
        dob: '1991-08-10',
        phone: '2485558888',
      },
      accountInfo: {
        noEmail: false,
        email: 'admin@example.com',
        password: 'StrongPass123',
        confirmPassword: 'StrongPass123',
      },
      screeningType: {
        requestedBy: 'self',
      },
      recipients: {
        additionalReferralRecipients: [],
      },
      terms: {
        agreeToTerms: true,
      },
    } as any)

    expect(result.success).toBe(true)
    expect(queueRedwoodImportForClient).toHaveBeenCalledWith('client-admin-1', 'admin-registration', payloadMock)
  })
})
