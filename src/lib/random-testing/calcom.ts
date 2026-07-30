import { TZDate } from '@date-fns/tz'

import { APP_TIMEZONE } from '@/lib/date-utils'
import { getCalcomEventType, getCalcomSchedule, type CalcomEventTypeRecord } from '@/utilities/calcom-api'
import { RANDOM_TESTING_SLOT_MINUTES } from './slots'

export const DEFAULT_RANDOM_TESTING_CALCOM_EVENT_TYPE_ID = 3684719
export const DEFAULT_RANDOM_TESTING_CALCOM_EVENT_SLUG = 'drug-test'
export const DEFAULT_RANDOM_TESTING_CALCOM_USERNAME = 'midrugtest'

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

export function getRandomTestingCalcomEventTypeId(): number {
  const configured = Number(process.env.RANDOM_TESTING_CALCOM_EVENT_TYPE_ID)
  if (!process.env.RANDOM_TESTING_CALCOM_EVENT_TYPE_ID?.trim()) {
    return DEFAULT_RANDOM_TESTING_CALCOM_EVENT_TYPE_ID
  }
  if (!Number.isInteger(configured) || configured <= 0) {
    throw new Error('RANDOM_TESTING_CALCOM_EVENT_TYPE_ID must be a positive integer.')
  }
  return configured
}

export async function getValidatedRandomTestingCalcomEventType(): Promise<CalcomEventTypeRecord> {
  const eventTypeId = getRandomTestingCalcomEventTypeId()
  const eventType = await getCalcomEventType({
    eventSlug: DEFAULT_RANDOM_TESTING_CALCOM_EVENT_SLUG,
    eventTypeId,
    username: DEFAULT_RANDOM_TESTING_CALCOM_USERNAME,
  })
  const configuredScheduleId = Number(process.env.RANDOM_TESTING_CALCOM_SCHEDULE_ID)

  if (eventType.price !== 0) {
    throw new Error(
      `Cal.com event type ${eventTypeId} must be explicitly unpaid (price: ${eventType.price ?? 'unknown'}).`,
    )
  }
  if (eventType.lengthInMinutes !== RANDOM_TESTING_SLOT_MINUTES) {
    throw new Error(
      `Cal.com event type ${eventTypeId} must be ${RANDOM_TESTING_SLOT_MINUTES} minutes; received ${eventType.lengthInMinutes ?? 'unknown'}.`,
    )
  }
  if (
    Number.isInteger(configuredScheduleId) &&
    configuredScheduleId > 0 &&
    eventType.scheduleId !== configuredScheduleId
  ) {
    throw new Error(
      `Cal.com event type ${eventTypeId} uses schedule ${eventType.scheduleId ?? 'unknown'}, not RANDOM_TESTING_CALCOM_SCHEDULE_ID ${configuredScheduleId}.`,
    )
  }

  return eventType
}
