import { describe, expect, test } from 'vitest'

import { formatDobInput, formatDobISO, formatRequiredDobISO, getAppTimezoneDayWindow, parseDob } from './date-utils'

describe('DOB parsing and formatting', () => {
  const referenceDate = new Date(2026, 6, 18)

  test.each([
    '11/30/88',
    '11/30/1988',
    '11-30-88',
    '11-30-1988',
    '1988-11-30',
    '1988/11/30',
    '1988-11-30T00:00:00.000Z',
    '113088',
    '11301988',
  ])('normalizes %s with the same DOB rules', (value) => {
    expect(formatDobInput(value, referenceDate)).toBe('11/30/1988')
    expect(formatDobISO(value, referenceDate)).toBe('1988-11-30')
  })

  test('accepts single-digit month and day variations', () => {
    expect(formatDobInput('1/2/90', referenceDate)).toBe('01/02/1990')
    expect(formatDobInput('01/2/1990', referenceDate)).toBe('01/02/1990')
    expect(formatDobInput('1-02-90', referenceDate)).toBe('01/02/1990')
  })

  test('uses the DOB century cutoff for two-digit years', () => {
    expect(formatDobISO('1/2/26', referenceDate)).toBe('2026-01-02')
    expect(formatDobISO('1/2/27', referenceDate)).toBe('1927-01-02')
  })

  test.each(['2/29/23', '13/1/90', '1/32/90', '1/1/1899', 'not-a-date'])('rejects invalid DOB %s', (value) => {
    expect(parseDob(value, referenceDate)).toBeNull()
    expect(formatDobInput(value, referenceDate)).toBe('')
    expect(formatDobISO(value, referenceDate)).toBe('')
  })

  test.each(['', 'January 15, 1990', '01.15.1990', 'not-a-date'])('fails closed for required DOB %s', (value) => {
    expect(() => formatRequiredDobISO(value, referenceDate)).toThrow('A valid date of birth is required.')
  })
})

describe('getAppTimezoneDayWindow', () => {
  test('uses the full New York calendar day during daylight saving time', () => {
    const window = getAppTimezoneDayWindow(new Date('2026-06-18T16:00:00.000Z'))

    expect(window.start.toISOString()).toBe('2026-06-18T04:00:00.000Z')
    expect(window.end.toISOString()).toBe('2026-06-19T04:00:00.000Z')
  })

  test('uses the full New York calendar day during standard time', () => {
    const window = getAppTimezoneDayWindow(new Date('2026-01-15T16:00:00.000Z'))

    expect(window.start.toISOString()).toBe('2026-01-15T05:00:00.000Z')
    expect(window.end.toISOString()).toBe('2026-01-16T05:00:00.000Z')
  })

  test('uses the app-local date instead of the UTC date near midnight', () => {
    const window = getAppTimezoneDayWindow(new Date('2026-06-18T03:30:00.000Z'))

    expect(window.start.toISOString()).toBe('2026-06-17T04:00:00.000Z')
    expect(window.end.toISOString()).toBe('2026-06-18T04:00:00.000Z')
  })
})
