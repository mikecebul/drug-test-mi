import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getPayload } from 'payload'
import { queueRedwoodImportForClient } from '@/lib/redwood/queue'
import { registerWebsiteClientAction } from '@/app/(frontend)/register/actions'

vi.mock('payload', () => ({
  getPayload: vi.fn(),
}))

vi.mock('@payload-config', () => ({
  default: {},
}))

vi.mock('@/lib/redwood/queue', () => ({
  queueRedwoodImportForClient: vi.fn(),
}))

describe('registerWebsiteClientAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('queues redwood import after successful frontend registration', async () => {
    const payloadMock: any = {
      find: vi.fn().mockResolvedValue({ docs: [] }),
      create: vi.fn().mockResolvedValue({ id: 'client-1', email: 'frontend@example.com' }),
      logger: {
        error: vi.fn(),
      },
    }

    vi.mocked(getPayload).mockResolvedValue(payloadMock)

    const result = await registerWebsiteClientAction({
      personalInfo: {
        firstName: 'Alex',
        middleInitial: 'Q',
        lastName: 'Taylor',
        gender: 'male',
        dob: '1990-01-15',
        phone: '2485551212',
        headshot: null,
      },
      accountInfo: {
        email: 'frontend@example.com',
        password: 'StrongPass123',
        confirmPassword: 'StrongPass123',
      },
      screeningType: {
        requestedBy: 'self',
      },
      recipients: {
        additionalReferralRecipients: [],
      },
      medications: [],
      terms: {
        agreeToTerms: true,
      },
    } as any)

    expect(result.success).toBe(true)
    expect(queueRedwoodImportForClient).toHaveBeenCalledWith('client-1', 'frontend-registration', payloadMock)
  })
})
