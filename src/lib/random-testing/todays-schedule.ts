import type { Payload, RequiredDataFromCollectionSlug } from 'payload'
import { TZDate } from '@date-fns/tz'

import { APP_TIMEZONE } from '@/lib/date-utils'
import type { Client } from '@/payload-types'
import { fetchTodaysScheduledCollections, type RedwoodScheduledCollection } from '@/lib/redwood/scheduled-collections'
import {
  cancelCalcomBooking,
  createCalcomBooking,
  listCalcomBookings,
  type CalcomBookingRecord,
} from '@/utilities/calcom-api'
import { revalidateBookingViews } from '@/utilities/revalidateBookingViews'
import { getRandomTestingCalcomConfig, getRandomTestingStart, localDateTimeToIso } from './calcom'

const SOURCE = 'toxaccess-random-testing'

type MatchingClient = {
  defaultTestType?: Client['defaultTestType']
  email: string
  firstName: string
  id: string
  lastName: string
  randomTestingActive?: boolean | null
  randomTestingSlotIndex?: number | null
  redwoodDonorId?: null | string
}

export type TodaysScheduledCollectionPreview = RedwoodScheduledCollection & {
  clientId: string | null
  collectionKey: string
  status: 'already-booked' | 'client-not-random-testing' | 'duplicate-client-match' | 'ready' | 'unmatched-client'
}

function localDateString(now = new Date()): string {
  const date = TZDate.tz(APP_TIMEZONE, now)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function metadataValue(booking: CalcomBookingRecord, name: string): string {
  const value = booking.metadata?.[name]
  return typeof value === 'string' ? value : ''
}

function isActiveCalcomBooking(booking: CalcomBookingRecord): boolean {
  return booking.status !== 'cancelled' && booking.status !== 'rejected'
}

async function findMatchingClients(payload: Payload, donorIds: string[]): Promise<Map<string, MatchingClient[]>> {
  if (donorIds.length === 0) return new Map()

  const result = await payload.find({
    collection: 'clients',
    where: {
      redwoodDonorId: {
        in: donorIds,
      },
    },
    depth: 0,
    limit: Math.max(donorIds.length * 2, 10),
    pagination: false,
    overrideAccess: true,
  })
  const matches = new Map<string, MatchingClient[]>()

  for (const client of result.docs) {
    const donorId = client.redwoodDonorId?.trim()
    if (!donorId) continue
    const current = matches.get(donorId) || []
    current.push(client as MatchingClient)
    matches.set(donorId, current)
  }
  return matches
}

async function findExistingCollectionKeys(payload: Payload, collectionKeys: string[]): Promise<Set<string>> {
  if (collectionKeys.length === 0) return new Set()
  const result = await payload.find({
    collection: 'bookings',
    where: {
      and: [
        {
          toxaccessCollectionKey: {
            in: collectionKeys,
          },
        },
        {
          status: {
            in: ['confirmed', 'pending'],
          },
        },
      ],
    },
    depth: 0,
    limit: collectionKeys.length,
    pagination: false,
    overrideAccess: true,
  })
  return new Set(result.docs.map((booking) => booking.toxaccessCollectionKey).filter(Boolean) as string[])
}

export async function previewTodaysScheduledCollections(
  payload: Payload,
  now = new Date(),
): Promise<TodaysScheduledCollectionPreview[]> {
  const collectionDate = localDateString(now)
  const collections = await fetchTodaysScheduledCollections()
  const clientsByDonorId = await findMatchingClients(
    payload,
    collections.map((collection) => collection.donorId),
  )
  const collectionKeys = collections.map((collection) => `${collectionDate}:${collection.donorId}`)
  const existingKeys = await findExistingCollectionKeys(payload, collectionKeys)

  return collections.map((collection) => {
    const clients = clientsByDonorId.get(collection.donorId) || []
    const collectionKey = `${collectionDate}:${collection.donorId}`
    let status: TodaysScheduledCollectionPreview['status']

    if (existingKeys.has(collectionKey)) status = 'already-booked'
    else if (clients.length === 0) status = 'unmatched-client'
    else if (clients.length > 1) status = 'duplicate-client-match'
    else if (!clients[0].randomTestingActive) status = 'client-not-random-testing'
    else status = 'ready'

    return {
      ...collection,
      clientId: clients.length === 1 ? clients[0].id : null,
      collectionKey,
      status,
    }
  })
}

function buildBookingData(input: {
  booking: CalcomBookingRecord
  client: MatchingClient
  collection: TodaysScheduledCollectionPreview
  end: string
  start: string
  timeZone: string
}): RequiredDataFromCollectionSlug<'bookings'> {
  const host = input.booking.hosts?.[0]
  const attendee = input.booking.attendees?.[0]
  return {
    title: `Random Drug Test - ${input.collection.donorName}`,
    type: '10min',
    description: 'Created from today’s ToxAccess Scheduled Collections page.',
    additionalNotes: `ToxAccess donor ID: ${input.collection.donorId}`,
    startTime: input.booking.start || input.start,
    endTime: input.booking.end || input.end,
    status: 'confirmed',
    organizer: {
      id: host?.id,
      name: host?.name || 'MI Drug Test',
      email: host?.email || process.env.RANDOM_TESTING_CALCOM_ATTENDEE_EMAIL || 'admin@midrugtest.com',
      timeZone: host?.timeZone || input.timeZone,
    },
    attendeeName: attendee?.name || `${input.client.firstName} ${input.client.lastName}`,
    attendeeEmail: attendee?.email || input.client.email,
    relatedClient: input.client.id,
    ...(input.client.defaultTestType ? { scheduledTestType: input.client.defaultTestType } : {}),
    location: 'MI Drug Test',
    calcomBookingId: input.booking.uid,
    calcomBookingNumericId: input.booking.id,
    eventTypeId: input.booking.eventTypeId,
    customInputs: {
      source: SOURCE,
      toxaccessDonorId: input.collection.donorId,
      toxaccessCollectionKey: input.collection.collectionKey,
    },
    webhookData: {
      source: SOURCE,
      booking: input.booking,
    },
    createdViaWebhook: false,
    toxaccessCollectionKey: input.collection.collectionKey,
    toxaccessDonorId: input.collection.donorId,
  }
}

async function ensurePayloadBooking(input: {
  booking: CalcomBookingRecord
  client: MatchingClient
  collection: TodaysScheduledCollectionPreview
  end: string
  payload: Payload
  start: string
  timeZone: string
}): Promise<string> {
  const existingResult = await input.payload.find({
    collection: 'bookings',
    where: {
      or: [
        { calcomBookingId: { equals: input.booking.uid } },
        { toxaccessCollectionKey: { equals: input.collection.collectionKey } },
      ],
    },
    depth: 0,
    limit: 1,
    overrideAccess: true,
  })
  const data = buildBookingData(input)
  const existing = existingResult.docs[0]
  if (existing) {
    const updated = await input.payload.update({
      collection: 'bookings',
      id: existing.id,
      data,
      overrideAccess: true,
    })
    return String(updated.id)
  }

  const created = await input.payload.create({
    collection: 'bookings',
    data,
    overrideAccess: true,
  })
  return String(created.id)
}

export async function syncTodaysScheduledCollections(payload: Payload, now = new Date()) {
  if (process.env.RANDOM_TESTING_SCHEDULE_SYNC_ENABLED !== 'true') {
    throw new Error('Random-testing schedule sync is disabled. Set RANDOM_TESTING_SCHEDULE_SYNC_ENABLED=true.')
  }

  const preview = await previewTodaysScheduledCollections(payload, now)
  const collectionDate = localDateString(now)
  const dayStart = localDateTimeToIso(collectionDate, 0, APP_TIMEZONE)
  const dayEnd = localDateTimeToIso(collectionDate, 24 * 60, APP_TIMEZONE)
  const calBookings = await listCalcomBookings({ afterStart: dayStart, beforeEnd: dayEnd })
  const config = getRandomTestingCalcomConfig()
  const results: Array<{
    bookingId?: string
    collectionKey: string
    error?: string
    placeholderCancelled?: boolean
    status: string
  }> = []

  for (const [ordinal, collection] of preview.entries()) {
    const reservationKey = `${collectionDate}:${ordinal}`
    const placeholder = calBookings.find(
      (booking) =>
        isActiveCalcomBooking(booking) &&
        metadataValue(booking, 'source') === SOURCE &&
        metadataValue(booking, 'kind') === 'placeholder' &&
        metadataValue(booking, 'randomTestingReservationKey') === reservationKey,
    )

    if (collection.status === 'already-booked') {
      if (placeholder) {
        const cancellation = await cancelCalcomBooking({
          bookingUid: placeholder.uid,
          cancellationReason: 'Named ToxAccess scheduled collection already exists.',
        })
        results.push({
          collectionKey: collection.collectionKey,
          error: cancellation.success ? undefined : cancellation.error,
          placeholderCancelled: cancellation.success,
          status: cancellation.success ? collection.status : 'existing-booking-placeholder-cancel-failed',
        })
      } else {
        results.push({ collectionKey: collection.collectionKey, status: collection.status })
      }
      continue
    }
    if (collection.status !== 'ready' || !collection.clientId) {
      results.push({ collectionKey: collection.collectionKey, status: collection.status })
      continue
    }

    const client = await payload.findByID({
      collection: 'clients',
      id: collection.clientId,
      depth: 0,
      overrideAccess: true,
    })
    if (typeof client.randomTestingSlotIndex !== 'number') {
      results.push({
        collectionKey: collection.collectionKey,
        error: 'Matched client is missing a random-testing slot.',
        status: 'manual-review',
      })
      continue
    }

    try {
      const timing = await getRandomTestingStart({
        collectionDate,
        slotIndex: client.randomTestingSlotIndex,
      })
      let actualBooking = calBookings.find(
        (booking) =>
          isActiveCalcomBooking(booking) &&
          metadataValue(booking, 'toxaccessCollectionKey') === collection.collectionKey,
      )
      if (!actualBooking) {
        actualBooking = await createCalcomBooking({
          attendee: {
            name: `${client.firstName} ${client.lastName}`,
            email: config.placeholderEmail,
            timeZone: timing.timeZone,
            language: 'en',
          },
          eventTypeId: config.eventTypeId,
          start: timing.start,
          metadata: {
            source: SOURCE,
            kind: 'scheduled-collection',
            toxaccessCollectionKey: collection.collectionKey,
            toxaccessDonorId: collection.donorId,
          },
        })
      }

      const bookingId = await ensurePayloadBooking({
        payload,
        booking: actualBooking,
        client: client as MatchingClient,
        collection,
        ...timing,
      })
      let placeholderCancelled = false
      let status = 'materialized'
      let error: string | undefined

      if (placeholder) {
        const cancellation = await cancelCalcomBooking({
          bookingUid: placeholder.uid,
          cancellationReason: 'Replaced by today’s named ToxAccess scheduled collection.',
        })
        placeholderCancelled = cancellation.success
        if (!cancellation.success) {
          status = 'materialized-placeholder-cancel-failed'
          error = cancellation.error
        }
      }

      results.push({
        bookingId,
        collectionKey: collection.collectionKey,
        error,
        placeholderCancelled,
        status,
      })
    } catch (error) {
      results.push({
        collectionKey: collection.collectionKey,
        error: error instanceof Error ? error.message : String(error),
        status: 'failed',
      })
    }
  }

  revalidateBookingViews()
  return { collectionDate, results }
}
