import { describe, expect, it } from 'vitest'

import { mapReferralTypeToRedwoodGroup } from '@/lib/redwood/groups'

describe('mapReferralTypeToRedwoodGroup', () => {
  it('maps the supported referral types to Redwood donor groups', () => {
    expect(mapReferralTypeToRedwoodGroup('court')).toBe('Court')
    expect(mapReferralTypeToRedwoodGroup('employer')).toBe('Employer')
    expect(mapReferralTypeToRedwoodGroup('self')).toBe('Self')
  })

  it('handles unexpected and missing referral types', () => {
    expect(mapReferralTypeToRedwoodGroup('')).toBe('')
    expect(mapReferralTypeToRedwoodGroup('unknown')).toBe('')
    expect(mapReferralTypeToRedwoodGroup(undefined)).toBe('')
    expect(mapReferralTypeToRedwoodGroup(null)).toBe('')
  })
})
