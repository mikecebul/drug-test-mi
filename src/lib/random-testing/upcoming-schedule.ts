import { cancelCalcomBooking, createCalcomBooking, listCalcomBookings } from '@/utilities/calcom-api'
import { fetchUpcomingScheduledCollections } from '@/lib/redwood/upcoming-scheduled-collections'
import { APP_TIMEZONE } from '@/lib/date-utils'
import { getRandomTestingCalcomConfig, getRandomTestingStart, localDateTimeToIso } from './calcom'

const SOURCE = 'toxaccess-random-testing'

function metadataValue(metadata: Record<string, unknown> | null | undefined, name: string): string {
  const value = metadata?.[name]
  return typeof value === 'string' ? value : ''
}

function isActiveCalcomStatus(status: string | undefined): boolean {
  return status !== 'cancelled' && status !== 'rejected'
}

export async function syncUpcomingRandomTestingPlaceholders() {
  if (process.env.RANDOM_TESTING_SCHEDULE_SYNC_ENABLED !== 'true') {
    throw new Error('Random-testing schedule sync is disabled. Set RANDOM_TESTING_SCHEDULE_SYNC_ENABLED=true.')
  }

  const days = await fetchUpcomingScheduledCollections()
  if (days.length === 0) return { created: 0, cancelled: 0, days: 0, unchanged: 0 }

  const sortedDates = days.map((day) => day.collectionDate).sort()
  const rangeStart = localDateTimeToIso(sortedDates[0], 0, APP_TIMEZONE)
  const lastDate = new Date(`${sortedDates[sortedDates.length - 1]}T12:00:00.000Z`)
  lastDate.setUTCDate(lastDate.getUTCDate() + 1)
  const rangeEndDate = lastDate.toISOString().slice(0, 10)
  const rangeEnd = localDateTimeToIso(rangeEndDate, 0, APP_TIMEZONE)
  const bookings = await listCalcomBookings({ afterStart: rangeStart, beforeEnd: rangeEnd })
  const config = getRandomTestingCalcomConfig()
  const desiredKeys = new Set<string>()
  let created = 0
  let unchanged = 0
  let cancelled = 0

  for (const day of days) {
    for (let ordinal = 0; ordinal < day.total; ordinal += 1) {
      const reservationKey = `${day.collectionDate}:${ordinal}`
      desiredKeys.add(reservationKey)
      const existing = bookings.find(
        (booking) =>
          isActiveCalcomStatus(booking.status) &&
          metadataValue(booking.metadata, 'source') === SOURCE &&
          metadataValue(booking.metadata, 'kind') === 'placeholder' &&
          metadataValue(booking.metadata, 'randomTestingReservationKey') === reservationKey,
      )
      if (existing) {
        unchanged += 1
        continue
      }

      const timing = await getRandomTestingStart({
        collectionDate: day.collectionDate,
        slotIndex: ordinal,
      })
      await createCalcomBooking({
        attendee: {
          name: `Random Testing Hold ${ordinal + 1}`,
          email: config.placeholderEmail,
          timeZone: timing.timeZone,
          language: 'en',
        },
        eventTypeId: config.eventTypeId,
        start: timing.start,
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

  for (const booking of bookings) {
    if (
      !isActiveCalcomStatus(booking.status) ||
      metadataValue(booking.metadata, 'source') !== SOURCE ||
      metadataValue(booking.metadata, 'kind') !== 'placeholder'
    ) {
      continue
    }
    const reservationKey = metadataValue(booking.metadata, 'randomTestingReservationKey')
    const collectionDate = metadataValue(booking.metadata, 'collectionDate')
    if (!days.some((day) => day.collectionDate === collectionDate) || desiredKeys.has(reservationKey)) continue

    const result = await cancelCalcomBooking({
      bookingUid: booking.uid,
      cancellationReason: 'ToxAccess no longer reports this upcoming random-testing allocation.',
    })
    if (!result.success) throw new Error(result.error || `Failed to cancel Cal.com placeholder ${booking.uid}.`)
    cancelled += 1
  }

  return { created, cancelled, days: days.length, unchanged }
}
