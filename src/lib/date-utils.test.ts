import { describe, expect, test } from 'vitest'

import { getAppTimezoneDayWindow } from './date-utils'

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
