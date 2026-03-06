import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getPayload } from 'payload'
import { queueRedwoodImportForClient } from '@/lib/redwood/queue'
import { registerClientFromWizard } from '@/views/DrugTestWizard/actions'

vi.mock('payload', () => ({
  getPayload: vi.fn(),
}))

vi.mock('@payload-config', () => ({
  default: {},
}))

vi.mock('@/lib/redwood/queue', () => ({
  queueRedwoodImportForClient: vi.fn(),
}))

describe('registerClientFromWizard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('queues redwood import after successful wizard registration', async () => {
    const payloadMock: any = {
      find: vi.fn().mockResolvedValue({ docs: [] }),
      create: vi.fn().mockResolvedValue({ id: 'client-wizard-1', email: 'wizard@example.com' }),
      logger: {
        info: vi.fn(),
        error: vi.fn(),
      },
    }

    vi.mocked(getPayload).mockResolvedValue(payloadMock)

    const result = await registerClientFromWizard({
      firstName: 'Taylor',
      middleInitial: 'M',
      lastName: 'Jordan',
      gender: 'male',
      dob: '1992-07-20',
      phone: '2485557777',
      email: 'wizard@example.com',
      referralType: 'self',
      additionalReferralRecipients: [],
    })

    expect(result.success).toBe(true)
    expect(queueRedwoodImportForClient).toHaveBeenCalledWith('client-wizard-1', 'wizard-registration', payloadMock)
  })
})
