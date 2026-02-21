import { describe, expect, test } from 'vitest'
import { recipientsSchema } from '../validators'

function buildBaseRecipientsInput() {
  return {
    screeningType: {
      requestedBy: 'court' as 'court' | 'employer' | 'self',
    },
    recipients: {
      additionalReferralRecipients: [] as Array<{ name: string; email: string }>,
      selectedEmployer: '',
      otherEmployerName: '',
      otherEmployerMainContactName: '',
      otherEmployerMainContactEmail: '',
      otherEmployerRecipientEmails: '',
      otherEmployerAdditionalRecipients: [] as Array<{ name?: string; email?: string }>,
      selectedCourt: 'court-1',
      otherCourtName: '',
      otherCourtMainContactName: '',
      otherCourtMainContactEmail: '',
      otherCourtRecipientEmails: '',
      otherCourtAdditionalRecipients: [] as Array<{ name?: string; email?: string }>,
    },
  }
}

describe('recipientsSchema additional referral recipients', () => {
  test('allows optional name with required email for court referrals', () => {
    const input = buildBaseRecipientsInput()
    input.recipients.additionalReferralRecipients = [
      { name: '', email: 'extra@client.com' },
    ]

    const result = recipientsSchema.safeParse(input)
    expect(result.success).toBe(true)
  })

  test('rejects invalid additional recipient email', () => {
    const input = buildBaseRecipientsInput()
    input.recipients.additionalReferralRecipients = [
      { name: 'Invalid', email: 'not-an-email' },
    ]

    const result = recipientsSchema.safeParse(input)
    expect(result.success).toBe(false)
  })

  test('rejects duplicate additional recipient emails case-insensitively', () => {
    const input = buildBaseRecipientsInput()
    input.recipients.additionalReferralRecipients = [
      { name: 'One', email: 'extra@client.com' },
      { name: 'Two', email: 'EXTRA@CLIENT.COM' },
    ]

    const result = recipientsSchema.safeParse(input)
    expect(result.success).toBe(false)
  })

  test('keeps self referral rules unchanged', () => {
    const result = recipientsSchema.safeParse({
      screeningType: {
        requestedBy: 'self',
      },
      recipients: {
        additionalReferralRecipients: [],
      },
    })

    expect(result.success).toBe(true)
  })

  test('rejects invalid additional recipient email for new employer referral', () => {
    const input = buildBaseRecipientsInput()
    input.screeningType.requestedBy = 'employer'
    input.recipients.selectedEmployer = 'other'
    input.recipients.otherEmployerName = 'New Employer'
    input.recipients.otherEmployerMainContactEmail = 'main@employer.com'
    input.recipients.otherEmployerAdditionalRecipients = [{ name: 'Bad', email: 'invalid-email' }]

    const result = recipientsSchema.safeParse(input)
    expect(result.success).toBe(false)
  })
})
