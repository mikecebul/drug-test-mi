import { fetchUpcomingScheduledCollections } from '@/lib/redwood/upcoming-scheduled-collections'
import { APP_TIMEZONE } from '@/lib/date-utils'
import {
  createGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
  listGoogleCalendarEvents,
} from '@/utilities/google-calendar-api'
import { getRandomTestingStart, localDateTimeToIso } from './calcom'

const SOURCE = 'toxaccess-random-testing'

function metadataValue(metadata: Record<string, string> | null | undefined, name: string): string {
  const value = metadata?.[name]
  return typeof value === 'string' ? value : ''
}

function localDateString(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

function addDateDays(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00.000Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

export async function syncUpcomingRandomTestingPlaceholders(now = new Date()) {
  if (process.env.RANDOM_TESTING_SCHEDULE_SYNC_ENABLED !== 'true') {
    throw new Error('Random-testing schedule sync is disabled. Set RANDOM_TESTING_SCHEDULE_SYNC_ENABLED=true.')
  }

  const days = await fetchUpcomingScheduledCollections()
  const today = localDateString(now)
  const sortedDates = [today, ...days.map((day) => day.collectionDate)].sort()
  const rangeStart = localDateTimeToIso(sortedDates[0], 0, APP_TIMEZONE)
  const rangeEndDate = [addDateDays(today, 15), ...days.map((day) => addDateDays(day.collectionDate, 1))].sort().at(-1)!
  const rangeEnd = localDateTimeToIso(rangeEndDate, 0, APP_TIMEZONE)
  const events = await listGoogleCalendarEvents({
    timeMin: rangeStart,
    timeMax: rangeEnd,
    privateExtendedProperties: [`source=${SOURCE}`, 'kind=placeholder'],
  })
  const desiredKeys = new Set<string>()
  let created = 0
  let unchanged = 0
  let cancelled = 0

  for (const day of days) {
    for (let ordinal = 0; ordinal < day.total; ordinal += 1) {
      const reservationKey = `${day.collectionDate}:${ordinal}`
      desiredKeys.add(reservationKey)
      const existing = events.find(
        (event) =>
          metadataValue(event.metadata, 'source') === SOURCE &&
          metadataValue(event.metadata, 'kind') === 'placeholder' &&
          metadataValue(event.metadata, 'randomTestingReservationKey') === reservationKey,
      )
      if (existing) {
        unchanged += 1
        continue
      }

      const timing = await getRandomTestingStart({
        collectionDate: day.collectionDate,
        slotIndex: ordinal,
      })
      await createGoogleCalendarEvent({
        summary: `Random Testing Hold ${ordinal + 1}`,
        description: 'Reserved from the ToxAccess upcoming random-testing schedule.',
        start: timing.start,
        end: timing.end,
        timeZone: timing.timeZone,
        metadata: {
          source: SOURCE,
          kind: 'placeholder',
          randomTestingReservationKey: reservationKey,
          collectionDate: day.collectionDate,
        },
      })
      created += 1
    }
  }

  for (const event of events) {
    if (metadataValue(event.metadata, 'source') !== SOURCE || metadataValue(event.metadata, 'kind') !== 'placeholder') {
      continue
    }
    const reservationKey = metadataValue(event.metadata, 'randomTestingReservationKey')
    if (desiredKeys.has(reservationKey)) continue

    await deleteGoogleCalendarEvent(event.id)
    cancelled += 1
  }

  return { created, cancelled, days: days.length, unchanged }
}
