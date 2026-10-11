import { TZDate } from '@date-fns/tz'
import { format } from 'date-fns'
import z from 'zod'
import { APP_TIMEZONE } from '@/lib/date-utils'
import { labTests } from './validators'

export const LAB_TEST_LABELS: Record<(typeof labTests)[number], string> = {
  '11-panel-lab': '11-Panel Lab',
  '11-panel-lab-no-etg': '11-Panel Lab (no EtG)',
  '8-panel-lab': '8-Panel Lab',
  '17-panel-sos-lab': '17-Panel SOS Lab',
  'etg-lab': 'EtG Lab',
}

export function collectionDateParts(value: string) {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return { date: '', time: '' }
  const local = TZDate.tz(APP_TIMEZONE, date)
  return { date: format(local, 'yyyy-MM-dd'), time: format(local, 'HH:mm') }
}

/** Interpret edits in the clinic timezone and retain seconds when only the test type changes. */
export function collectionDateFromParts(date: string, time: string, original?: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null
  const [year, month, day] = date.split('-').map(Number)
  const [hour, minute] = time.split(':').map(Number)
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null
  const edited = new TZDate(year, month - 1, day, hour, minute, 0, 0, APP_TIMEZONE)
  // Reject impossible calendar dates and skipped daylight-saving hours instead of silently shifting them.
  if (!Number.isFinite(edited.getTime()) || format(edited, 'yyyy-MM-dd') !== date || format(edited, 'HH:mm') !== time)
    return null
  if (original) {
    const previous = collectionDateParts(original)
    if (previous.date === date && previous.time === time) return original
  }
  return new Date(edited.getTime()).toISOString()
}

export function collectionDateLabel(value: string) {
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? format(TZDate.tz(APP_TIMEZONE, date), 'MM/dd/yyyy h:mm a') : 'Not set'
}

export const collectionDetailsSchema = z
  .object({
    testType: z.enum(labTests),
    date: z.string().min(1, 'Collection date is required'),
    time: z.string().min(1, 'Collection time is required'),
  })
  .superRefine((value, context) => {
    if (value.date && value.time && !collectionDateFromParts(value.date, value.time))
      context.addIssue({ code: 'custom', path: ['date'], message: 'Enter a valid collection date and time.' })
  })
