import { describe, expect, test } from 'vitest'
import {
  buildInitialReferralProfileValues,
  mapClientTypeToReferralTypeUi,
  mapReferralTypeUiToClientType,
  referralProfileSchema,
} from '../referral-profile-schema'

describe('referralProfileSchema', () => {
  test('allows self referral type with zero recipients', () => {
    const result = referralProfileSchema.safeParse({
      referralTypeUi: 'self',
      presetKey: 'custom',
      title: 'Self',
      recipients: [],
    })

    expect(result.success).toBe(true)
  })

  test('requires at least one recipient for court', () => {
    const result = referralProfileSchema.safeParse({
      referralTypeUi: 'court',
      presetKey: 'custom',
      title: 'Some Court',
      recipients: [],
    })

    expect(result.success).toBe(false)
  })

  test('requires at least one recipient for employer', () => {
    const result = referralProfileSchema.safeParse({
      referralTypeUi: 'employer',
      presetKey: 'custom',
      title: 'Some Employer',
      recipients: [],
    })

    expect(result.success).toBe(false)
  })
})

describe('referral type mapping', () => {
  test('maps self client type to self UI type', () => {
    expect(mapClientTypeToReferralTypeUi('self')).toBe('self')
  })

  test('maps self UI type to self client type', () => {
    expect(mapReferralTypeUiToClientType('self')).toBe('self')
  })
})

describe('buildInitialReferralProfileValues', () => {
  test('builds self defaults with zero recipients when none provided', () => {
    const values = buildInitialReferralProfileValues({
      clientType: 'self',
      referralTitle: 'Self',
      referralRecipientsDetailed: [],
      fallbackReferralEmails: [],
    })

    expect(values.referralTypeUi).toBe('self')
    expect(values.recipients).toHaveLength(0)
  })
})
