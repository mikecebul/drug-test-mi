import { describe, expect, test } from 'vitest'

import { extractPreferredTestType, extractReferralRelation, formatPhoneForCal } from '@/lib/quick-book'

describe('quick-book helpers', () => {
  test('formats US phone numbers for Cal.com', () => {
    expect(formatPhoneForCal('(231) 555-1212')).toBe('+12315551212')
    expect(formatPhoneForCal('+1 (231) 555-1212')).toBe('+12315551212')
    expect(formatPhoneForCal('555-1212')).toBeUndefined()
  })

  test('extracts preferred test type from string and populated object', () => {
    expect(extractPreferredTestType('test-type-id')).toEqual({ recommendedTestTypeId: 'test-type-id' })
    expect(
      extractPreferredTestType({
        id: 'abc',
        value: '11-panel-lab',
      }),
    ).toEqual({
      recommendedTestTypeId: 'abc',
      recommendedTestTypeValue: '11-panel-lab',
    })
  })

  test('extracts referral relation id for both unpopulated and populated relation values', () => {
    expect(
      extractReferralRelation({
        relationTo: 'courts',
        value: 'court-id',
      }),
    ).toEqual({ relationTo: 'courts', referralId: 'court-id' })

    expect(
      extractReferralRelation({
        relationTo: 'employers',
        value: { id: 'employer-id', name: 'Acme' },
      }),
    ).toEqual({ relationTo: 'employers', referralId: 'employer-id' })
  })
})
