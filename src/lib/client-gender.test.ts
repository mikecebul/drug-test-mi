import { describe, expect, it } from 'vitest'
import { CLIENT_GENDER_OPTIONS, formatClientGender, normalizeClientGender } from './client-gender'

describe('client gender options', () => {
  it('offers only male, female, and prefer not to say', () => {
    expect(CLIENT_GENDER_OPTIONS).toEqual([
      { value: 'male', label: 'Male' },
      { value: 'female', label: 'Female' },
      { value: 'prefer-not-to-say', label: 'Prefer not to say' },
    ])
  })

  it('normalizes the retired other value without losing existing profiles', () => {
    expect(normalizeClientGender('other')).toBe('prefer-not-to-say')
    expect(formatClientGender('other')).toBe('Prefer not to say')
  })
})
