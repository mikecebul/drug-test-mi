import { describe, expect, test } from 'vitest'

import { shiftStoredDobByUtcDays } from '@/migrations/20260723_203006_increase_client_dobs_one_day'

describe('shiftStoredDobByUtcDays', () => {
  test.each([
    [new Date('1985-10-15T00:00:00.000Z'), '1985-10-16T12:00:00.000Z', '1985-10-16'],
    [new Date('1985-10-15T12:00:00.000Z'), '1985-10-16T12:00:00.000Z', '1985-10-16'],
    ['1999-12-31', '2000-01-01T12:00:00.000Z', '2000-01-01'],
    ['2024-02-28T00:00:00.000Z', '2024-02-29T12:00:00.000Z', '2024-02-29'],
  ])('increases %s by one UTC calendar day', (value, expectedDob, expectedSearchDob) => {
    const shifted = shiftStoredDobByUtcDays(value, 1)

    expect(shifted?.dob.toISOString()).toBe(expectedDob)
    expect(shifted?.searchDob).toBe(expectedSearchDob)
  })

  test('reverses the correction in the down direction', () => {
    const shifted = shiftStoredDobByUtcDays(new Date('1985-10-16T12:00:00.000Z'), -1)

    expect(shifted?.dob.toISOString()).toBe('1985-10-15T12:00:00.000Z')
    expect(shifted?.searchDob).toBe('1985-10-15')
  })

  test.each([null, undefined, 'not-a-date', '1985-02-30', new Date('not-a-date')])(
    'rejects missing or invalid value %s',
    (value) => {
      expect(shiftStoredDobByUtcDays(value, 1)).toBeNull()
    },
  )
})
