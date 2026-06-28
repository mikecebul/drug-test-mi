import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/admin-alerts', () => ({
  createAdminAlert: vi.fn(),
}))

import { sendEmails } from '@/collections/DrugTests/services/emailSender'

describe('sendEmails email safety', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('sends one test email instead of the client and referral list when not live', async () => {
    vi.stubEnv('NEXT_PUBLIC_IS_LIVE', 'false')
    vi.stubEnv('EMAIL_TEST_ADDRESS', 'mike@midrugtest.com')

    const payload: any = {
      logger: {
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
      },
      sendEmail: vi.fn().mockResolvedValue(undefined),
    }

    const result = await sendEmails({
      payload,
      clientEmail: 'client@example.com',
      clientEmailData: {
        subject: 'Client Result',
        html: '<p>client</p>',
      },
      referralEmails: ['referral.one@example.com', 'referral.two@example.com', 'tom@midrugtest.com'],
      referralEmailData: {
        subject: 'Referral Result',
        html: '<p>referral</p>',
      },
      emailStage: 'complete',
      drugTestId: 'test-1',
      clientId: 'client-1',
      clientName: 'Test Client',
    })

    expect(payload.sendEmail).toHaveBeenCalledTimes(1)
    expect(payload.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'mike@midrugtest.com',
        subject: '[TEST MODE] Referral Result',
        html: '<p>referral</p>',
      }),
    )
    expect(result).toEqual({
      sentTo: ['Test: mike@midrugtest.com (TEST MODE)'],
      failedRecipients: [],
    })
  })
})
