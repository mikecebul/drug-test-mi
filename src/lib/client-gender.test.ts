import { describe, expect, it } from 'vitest'
import {
  CLIENT_GENDER_OPTIONS,
  formatClientGender,
  getBookingGenderFromInputs,
  normalizeBookingGender,
  normalizeClientGender,
} from './client-gender'

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

  it('normalizes optional Cal.com gender responses', () => {
    expect(normalizeBookingGender('Male')).toBe('male')
    expect(normalizeBookingGender('F')).toBe('female')
    expect(normalizeBookingGender('Unknown')).toBeUndefined()
    expect(normalizeBookingGender('')).toBeUndefined()
  })

  it('extracts gender from Cal.com response shapes and leaves blank responses unknown', () => {
    expect(getBookingGenderFromInputs({ gender: 'Female' })).toBe('female')
    expect(
      getBookingGenderFromInputs({
        customQuestion: {
          label: 'Gender',
          value: 'Male',
        },
      }),
    ).toBe('male')
    expect(getBookingGenderFromInputs({ gender: '' })).toBeUndefined()
    expect(getBookingGenderFromInputs({ gender: 'Unknown' })).toBeUndefined()
  })
})
