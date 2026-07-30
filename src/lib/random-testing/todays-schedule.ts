import type { Payload, RequiredDataFromCollectionSlug } from 'payload'
import { TZDate } from '@date-fns/tz'

import { APP_TIMEZONE } from '@/lib/date-utils'
import type { Client } from '@/payload-types'
import { fetchTodaysScheduledCollections, type RedwoodScheduledCollection } from '@/lib/redwood/scheduled-collections'
import {
  createGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
  getGoogleCalendarConfig,
  listGoogleCalendarEvents,
  updateGoogleCalendarEvent,
  type GoogleCalendarEventInput,
  type GoogleCalendarEventRecord,
} from '@/utilities/google-calendar-api'
import { revalidateBookingViews } from '@/utilities/revalidateBookingViews'
import { getRandomTestingStart, localDateTimeToIso } from './calcom'

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

function metadataValue(event: GoogleCalendarEventRecord, name: string): string {
  const value = event.metadata?.[name]
  return typeof value === 'string' ? value : ''
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
  calendarEvent: GoogleCalendarEventRecord
  client: MatchingClient
  collection: TodaysScheduledCollectionPreview
  end: string
  start: string
  timeZone: string
}): RequiredDataFromCollectionSlug<'bookings'> {
  const calendarConfig = getGoogleCalendarConfig()
  return {
    title: `Random Drug Test - ${input.collection.donorName}`,
    type: '10min',
    description: 'Created from today’s ToxAccess Scheduled Collections page.',
    additionalNotes: `ToxAccess donor ID: ${input.collection.donorId}`,
    startTime: input.calendarEvent.start || input.start,
    endTime: input.calendarEvent.end || input.end,
    status: 'confirmed',
    organizer: {
      name: calendarConfig.organizerName,
      email: calendarConfig.organizerEmail,
      timeZone: input.timeZone,
    },
    attendeeName: `${input.client.firstName} ${input.client.lastName}`,
    attendeeEmail: input.client.email,
    relatedClient: input.client.id,
    ...(input.client.defaultTestType ? { scheduledTestType: input.client.defaultTestType } : {}),
    location: 'MI Drug Test',
    googleCalendarEventId: input.calendarEvent.id,
    customInputs: {
      source: SOURCE,
      toxaccessDonorId: input.collection.donorId,
      toxaccessCollectionKey: input.collection.collectionKey,
    },
    webhookData: {
      source: SOURCE,
      calendarEvent: input.calendarEvent,
    },
    createdViaWebhook: false,
    toxaccessCollectionKey: input.collection.collectionKey,
    toxaccessDonorId: input.collection.donorId,
  }
}

async function ensurePayloadBooking(input: {
  calendarEvent: GoogleCalendarEventRecord
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
        { googleCalendarEventId: { equals: input.calendarEvent.id } },
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

function buildNamedCalendarEvent(input: {
  collectionDate: string
  collection: TodaysScheduledCollectionPreview
  end: string
  reservationKey: string
  start: string
  timeZone: string
}): GoogleCalendarEventInput {
  return {
    summary: `Random Drug Test - ${input.collection.donorName}`,
    description: `Created from ToxAccess Scheduled Collections.\nDonor ID: ${input.collection.donorId}`,
    location: 'MI Drug Test',
    start: input.start,
    end: input.end,
    timeZone: input.timeZone,
    remindersUseDefault: true,
    metadata: {
      source: SOURCE,
      kind: 'scheduled-collection',
      randomTestingReservationKey: input.reservationKey,
      toxaccessCollectionKey: input.collection.collectionKey,
      toxaccessDonorId: input.collection.donorId,
      collectionDate: input.collectionDate,
    },
  }
}

export async function syncTodaysScheduledCollections(payload: Payload, now = new Date()) {
  if (process.env.RANDOM_TESTING_SCHEDULE_SYNC_ENABLED !== 'true') {
    throw new Error('Random-testing schedule sync is disabled. Set RANDOM_TESTING_SCHEDULE_SYNC_ENABLED=true.')
  }

  const preview = await previewTodaysScheduledCollections(payload, now)
  const collectionDate = localDateString(now)
  const dayStart = localDateTimeToIso(collectionDate, 0, APP_TIMEZONE)
  const dayEnd = localDateTimeToIso(collectionDate, 24 * 60, APP_TIMEZONE)
  const calendarEvents = await listGoogleCalendarEvents({
    timeMin: dayStart,
    timeMax: dayEnd,
    privateExtendedProperties: [`source=${SOURCE}`],
  })
  const results: Array<{
    bookingId?: string
    collectionKey: string
    error?: string
    placeholderCancelled?: boolean
    placeholderReplaced?: boolean
    status: string
  }> = []

  for (const [ordinal, collection] of preview.entries()) {
    const reservationKey = `${collectionDate}:${ordinal}`
    const placeholder = calendarEvents.find(
      (event) =>
        metadataValue(event, 'source') === SOURCE &&
        metadataValue(event, 'kind') === 'placeholder' &&
        metadataValue(event, 'randomTestingReservationKey') === reservationKey,
    )

    if (collection.status === 'already-booked') {
      if (placeholder) {
        let error: string | undefined
        try {
          await deleteGoogleCalendarEvent(placeholder.id)
        } catch (deleteError) {
          error = deleteError instanceof Error ? deleteError.message : String(deleteError)
        }
        results.push({
          collectionKey: collection.collectionKey,
          error,
          placeholderCancelled: !error,
          status: error ? 'existing-booking-placeholder-cancel-failed' : collection.status,
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
      const eventInput = buildNamedCalendarEvent({
        collection,
        collectionDate,
        reservationKey,
        ...timing,
      })
      let actualCalendarEvent = calendarEvents.find(
        (event) => metadataValue(event, 'toxaccessCollectionKey') === collection.collectionKey,
      )
      let placeholderReplaced = false
      if (!actualCalendarEvent && placeholder) {
        actualCalendarEvent = await updateGoogleCalendarEvent({
          eventId: placeholder.id,
          event: eventInput,
        })
        placeholderReplaced = true
      } else if (!actualCalendarEvent) {
        actualCalendarEvent = await createGoogleCalendarEvent(eventInput)
      } else {
        actualCalendarEvent = await updateGoogleCalendarEvent({
          eventId: actualCalendarEvent.id,
          event: eventInput,
        })
      }

      const bookingId = await ensurePayloadBooking({
        payload,
        calendarEvent: actualCalendarEvent,
        client: client as MatchingClient,
        collection,
        ...timing,
      })
      let placeholderCancelled = false
      let status = 'materialized'
      let error: string | undefined

      if (placeholder && !placeholderReplaced) {
        try {
          await deleteGoogleCalendarEvent(placeholder.id)
          placeholderCancelled = true
        } catch (deleteError) {
          status = 'materialized-placeholder-cancel-failed'
          error = deleteError instanceof Error ? deleteError.message : String(deleteError)
        }
      }

      results.push({
        bookingId,
        collectionKey: collection.collectionKey,
        error,
        placeholderCancelled,
        placeholderReplaced,
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
