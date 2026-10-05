import { describe, expect, it } from 'vitest'

import { formatJobWaitUntil, getActiveJobStatus } from '../activeJobs'

describe('dashboard job timing', () => {
  const now = new Date('2026-10-05T04:54:00.000Z')

  it('shows all four advance-scheduled production tasks as scheduled', () => {
    const dueDates = [
      '2026-10-05T10:05:00.000Z', // Monday holds
      '2026-11-01T19:00:00.000Z', // Next monthly invoices (after DST changes)
      '2026-10-05T10:00:00.000Z', // Today's donor bookings
      '2026-10-05T07:00:00.000Z', // Nightly invoice payments at 3 a.m. EDT
    ]
    expect(dueDates.map((waitUntil) => getActiveJobStatus({ processing: false, waitUntil }, now))).toEqual([
      'scheduled',
      'scheduled',
      'scheduled',
      'scheduled',
    ])
  })

  it.each([undefined, null, '2026-10-05T04:00:00.000Z', now.toISOString()])(
    'shows immediately runnable or due work as queued (%s)',
    (waitUntil) => {
      expect(getActiveJobStatus({ processing: false, waitUntil }, now)).toBe('queued')
    },
  )

  it('prioritizes processing state over the scheduled time', () => {
    expect(getActiveJobStatus({ processing: true, waitUntil: '2026-11-01T19:00:00.000Z' }, now)).toBe('running')
  })

  it('switches an advance-scheduled job to queued when its due time arrives', () => {
    const job = { processing: false, waitUntil: '2026-10-05T10:05:00.000Z' }
    expect(getActiveJobStatus(job, now)).toBe('scheduled')
    expect(getActiveJobStatus(job, new Date(job.waitUntil))).toBe('queued')
  })

  it('formats due times in Eastern time across the daylight saving transition', () => {
    expect(formatJobWaitUntil('2026-10-05T07:00:00.000Z')).toBe('Oct 5, 2026, 3:00 AM EDT')
    expect(formatJobWaitUntil('2026-10-05T10:05:00.000Z')).toBe('Oct 5, 2026, 6:05 AM EDT')
    expect(formatJobWaitUntil('2026-11-01T19:00:00.000Z')).toBe('Nov 1, 2026, 2:00 PM EST')
    expect(formatJobWaitUntil(null)).toBeUndefined()
  })
})
