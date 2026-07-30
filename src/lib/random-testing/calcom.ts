import { TZDate } from '@date-fns/tz'

import { APP_TIMEZONE } from '@/lib/date-utils'
import { getCalcomSchedule } from '@/utilities/calcom-api'
import { RANDOM_TESTING_SLOT_MINUTES } from './slots'

function readTime(value: string | null | undefined): string | null {
  if (!value) return null
  const match = value.match(/(?:T|^)(\d{2}):(\d{2})/)
  return match ? `${match[1]}:${match[2]}` : null
}

function minutesFromTime(value: string): number {
  const [hours, minutes] = value.split(':').map(Number)
  return hours * 60 + minutes
}

function roundUpToGrid(minutes: number): number {
  return Math.ceil(minutes / RANDOM_TESTING_SLOT_MINUTES) * RANDOM_TESTING_SLOT_MINUTES
}

const CALCOM_DAY_INDEX: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
}

function includesDay(days: Array<number | string> | undefined, day: number): boolean {
  return Boolean(
    days?.some((value) =>
      typeof value === 'number' ? value === day : CALCOM_DAY_INDEX[value.trim().toLowerCase()] === day,
    ),
  )
}

export function localDateTimeToIso(date: string, totalMinutes: number, timeZone: string): string {
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) throw new Error(`Invalid local collection date: ${date}`)
  const local = new TZDate(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Math.floor(totalMinutes / 60),
    totalMinutes % 60,
    0,
    0,
    timeZone,
  )
  return new Date(local.getTime()).toISOString()
}

export async function getRandomTestingStart(input: {
  collectionDate: string
  slotIndex: number
}): Promise<{ end: string; start: string; timeZone: string }> {
  const configuredScheduleId = Number(process.env.RANDOM_TESTING_CALCOM_SCHEDULE_ID)
  const schedule = await getCalcomSchedule(
    Number.isInteger(configuredScheduleId) && configuredScheduleId > 0 ? configuredScheduleId : undefined,
  )
  const timeZone = schedule.timeZone || APP_TIMEZONE
  const day = new Date(`${input.collectionDate}T12:00:00.000Z`).getUTCDay()
  const overrides = schedule.overrides || schedule.dateOverrides
  const override = overrides?.find((entry) => entry.date?.slice(0, 10) === input.collectionDate)
  const overrideStart = readTime(override?.startTime)
  const regularStart = schedule.availability
    ?.filter((entry) => includesDay(entry.days, day))
    .map((entry) => readTime(entry.startTime))
    .filter((value): value is string => Boolean(value))
    .sort()[0]

  if (override && !overrideStart) {
    throw new Error(`Cal.com marks ${input.collectionDate} unavailable.`)
  }

  const scheduleStart = overrideStart || regularStart
  if (!scheduleStart) {
    throw new Error(`Cal.com has no availability configured for ${input.collectionDate}.`)
  }

  const startMinutes = roundUpToGrid(minutesFromTime(scheduleStart)) + input.slotIndex * RANDOM_TESTING_SLOT_MINUTES
  return {
    start: localDateTimeToIso(input.collectionDate, startMinutes, timeZone),
    end: localDateTimeToIso(input.collectionDate, startMinutes + RANDOM_TESTING_SLOT_MINUTES, timeZone),
    timeZone,
  }
}
