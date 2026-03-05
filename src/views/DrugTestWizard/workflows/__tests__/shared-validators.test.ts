import { describe, expect, test } from 'vitest'
import { emailsSchema } from '../shared-validators'

describe('emailsSchema', () => {
  test('allows disabled referral emails with no recipients', () => {
    const result = emailsSchema.safeParse({
      emails: {
        clientEmailEnabled: false,
        clientRecipients: [],
        referralEmailEnabled: false,
        referralRecipients: [],
      },
    })

    expect(result.success).toBe(true)
  })

  test('requires recipients when referral emails are enabled', () => {
    const result = emailsSchema.safeParse({
      emails: {
        clientEmailEnabled: false,
        clientRecipients: [],
        referralEmailEnabled: true,
        referralRecipients: [],
      },
    })

    expect(result.success).toBe(false)

    if (result.success) {
      return
    }

    const issue = result.error.issues.find((entry) => entry.message === 'Referral emails must have at least one recipient')
    expect(issue?.path).toEqual(['emails', 'referralRecipients'])
  })
})
