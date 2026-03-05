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
      additionalRecipients: [],
    })

    expect(result.success).toBe(true)
  })

  test('requires at least one recipient for court', () => {
    const result = referralProfileSchema.safeParse({
      referralTypeUi: 'court',
      presetKey: 'custom',
      title: 'Some Court',
      recipients: [],
      additionalRecipients: [],
    })

    expect(result.success).toBe(false)
  })

  test('requires at least one recipient for employer', () => {
    const result = referralProfileSchema.safeParse({
      referralTypeUi: 'employer',
      presetKey: 'custom',
      title: 'Some Employer',
      recipients: [],
      additionalRecipients: [],
    })

    expect(result.success).toBe(false)
  })

  test('rejects duplicate additional recipients (case-insensitive)', () => {
    const result = referralProfileSchema.safeParse({
      referralTypeUi: 'court',
      presetKey: 'court-1',
      title: 'Some Court',
      recipients: [
        { rowId: 'row-1', name: 'Preset', email: 'preset@court.gov' },
      ],
      additionalRecipients: [
        { rowId: 'row-2', name: 'A', email: 'extra@court.gov' },
        { rowId: 'row-3', name: 'B', email: 'EXTRA@COURT.GOV' },
      ],
    })

    expect(result.success).toBe(false)
  })

  test('rejects additional recipient that already exists in preset recipients', () => {
    const result = referralProfileSchema.safeParse({
      referralTypeUi: 'court',
      presetKey: 'court-1',
      title: 'Some Court',
      recipients: [
        { rowId: 'row-1', name: 'Preset', email: 'preset@court.gov' },
      ],
      additionalRecipients: [
        { rowId: 'row-2', name: 'Duplicate', email: 'PRESET@COURT.GOV' },
      ],
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
    expect(values.additionalRecipients).toHaveLength(0)
  })

  test('separates preset recipients from client additional recipients', () => {
    const values = buildInitialReferralProfileValues({
      clientType: 'court',
      referralPresetId: 'court-123',
      referralTitle: 'Preset Court',
      referralRecipientsDetailed: [
        { name: 'Preset Contact', email: 'preset@court.gov' },
        { name: 'Client Extra', email: 'extra@client.com' },
      ],
      clientAdditionalRecipientsDetailed: [
        { name: 'Client Extra', email: 'extra@client.com' },
      ],
      fallbackReferralEmails: [],
    })

    expect(values.presetKey).toBe('court-123')
    expect(values.recipients).toHaveLength(1)
    expect(values.recipients[0]?.email).toBe('preset@court.gov')
    expect(values.additionalRecipients).toHaveLength(1)
    expect(values.additionalRecipients[0]?.email).toBe('extra@client.com')
  })
})
