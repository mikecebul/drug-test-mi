import type { Payload, RequiredDataFromCollectionSlug } from 'payload'
import { TZDate } from '@date-fns/tz'

import { getTestTypeBookingLabel } from '@/config/test-types'
import { APP_TIMEZONE } from '@/lib/date-utils'
import { formatPhoneForCal } from '@/lib/quick-book'
import type { Client } from '@/payload-types'
import { fetchTodaysScheduledCollections, type RedwoodScheduledCollection } from '@/lib/redwood/scheduled-collections'
import { createCalcomBooking, listCalcomBookings, type CalcomBookingRecord } from '@/utilities/calcom-api'
import { deleteGoogleCalendarEvent, listGoogleCalendarEvents } from '@/utilities/google-calendar-api'
import { getRandomTestingStart, getValidatedRandomTestingCalcomEventType, localDateTimeToIso } from './calcom'

const SOURCE = 'toxaccess-random-testing'

type MatchingClient = {
  defaultTestType?: Client['defaultTestType']
  email: string
  firstName: string
  id: string
  lastName: string
  phone?: string | null
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

function metadataValue(metadata: Record<string, unknown> | null | undefined, name: string): string {
  const value = metadata?.[name]
  return typeof value === 'string' ? value : ''
}

function isDuplicateKeyError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const record = error as { cause?: unknown; code?: unknown; message?: unknown }
  return (
    record.code === 11000 ||
    (typeof record.message === 'string' && /duplicate\s+key/i.test(record.message)) ||
    isDuplicateKeyError(record.cause)
  )
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
  calcomBooking: CalcomBookingRecord
  client: MatchingClient
  collection: TodaysScheduledCollectionPreview
  end: string
  eventTypeId: number
  start: string
  timeZone: string
}): RequiredDataFromCollectionSlug<'bookings'> {
  const host = input.calcomBooking.hosts?.[0]
  return {
    title: `Random Drug Test - ${input.collection.donorName}`,
    type: '10min',
    description: 'Created from today’s ToxAccess Scheduled Collections page.',
    additionalNotes: `ToxAccess donor ID: ${input.collection.donorId}`,
    startTime: input.calcomBooking.start || input.start,
    endTime: input.calcomBooking.end || input.end,
    status: 'confirmed',
    organizer: {
      ...(typeof host?.id === 'number' ? { id: host.id } : {}),
      name: host?.name || 'MI Drug Test',
      email: host?.email || process.env.GOOGLE_CALENDAR_ORGANIZER_EMAIL || 'booking@midrugtest.com',
      timeZone: host?.timeZone || input.timeZone,
    },
    attendeeName: `${input.client.firstName} ${input.client.lastName}`,
    attendeeEmail: input.client.email,
    relatedClient: input.client.id,
    ...(input.client.defaultTestType ? { scheduledTestType: input.client.defaultTestType } : {}),
    location: input.calcomBooking.location || 'MI Drug Test',
    calcomBookingId: input.calcomBooking.uid,
    calcomBookingNumericId: input.calcomBooking.id,
    eventTypeId: input.calcomBooking.eventTypeId || input.eventTypeId,
    payment: {
      amountDue: 0,
      amountPaid: 0,
      method: 'not-paid',
      status: 'unpaid',
      notes: 'Random-testing appointment created without prepayment.',
    },
    customInputs: {
      ...input.calcomBooking.bookingFieldsResponses,
      source: SOURCE,
      toxaccessDonorId: input.collection.donorId,
      toxaccessCollectionKey: input.collection.collectionKey,
    },
    webhookData: {
      source: SOURCE,
      calcomBooking: input.calcomBooking,
    },
    createdViaWebhook: false,
    toxaccessCollectionKey: input.collection.collectionKey,
    toxaccessDonorId: input.collection.donorId,
  }
}

async function ensurePayloadBooking(input: {
  calcomBooking: CalcomBookingRecord
  client: MatchingClient
  collection: TodaysScheduledCollectionPreview
  end: string
  eventTypeId: number
  payload: Payload
  start: string
  timeZone: string
}): Promise<string> {
  const findExisting = () =>
    input.payload.find({
      collection: 'bookings',
      where: {
        or: [
          { calcomBookingId: { equals: input.calcomBooking.uid } },
          { toxaccessCollectionKey: { equals: input.collection.collectionKey } },
        ],
      },
      depth: 0,
      limit: 1,
      overrideAccess: true,
    })
  const existingResult = await findExisting()
  const data = buildBookingData(input)
  let existing = existingResult.docs[0]
  if (existing) {
    data.createdViaWebhook = Boolean(existing.createdViaWebhook)
    const updated = await input.payload.update({
      collection: 'bookings',
      id: existing.id,
      data,
      overrideAccess: true,
    })
    return String(updated.id)
  }

  try {
    const created = await input.payload.create({
      collection: 'bookings',
      data,
      overrideAccess: true,
    })
    return String(created.id)
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error
    existing = (await findExisting()).docs[0]
    if (!existing) throw error

    data.createdViaWebhook = Boolean(existing.createdViaWebhook)
    const updated = await input.payload.update({
      collection: 'bookings',
      id: existing.id,
      data,
      overrideAccess: true,
    })
    return String(updated.id)
  }
}

function isActiveCalcomBooking(booking: CalcomBookingRecord): boolean {
  return !['cancelled', 'rejected'].includes(booking.status?.toLowerCase() || '')
}

export async function syncTodaysScheduledCollections(payload: Payload, now = new Date()) {
  if (process.env.RANDOM_TESTING_SCHEDULE_SYNC_ENABLED !== 'true') {
    throw new Error('Random-testing schedule sync is disabled. Set RANDOM_TESTING_SCHEDULE_SYNC_ENABLED=true.')
  }

  const preview = await previewTodaysScheduledCollections(payload, now)
  const collectionDate = localDateString(now)
  const dayStart = localDateTimeToIso(collectionDate, 0, APP_TIMEZONE)
  const dayEnd = localDateTimeToIso(collectionDate, 24 * 60, APP_TIMEZONE)
  const [calendarEvents, calcomBookings] = await Promise.all([
    listGoogleCalendarEvents({
      timeMin: dayStart,
      timeMax: dayEnd,
      privateExtendedProperties: [`source=${SOURCE}`],
    }),
    listCalcomBookings({
      afterStart: dayStart,
      beforeEnd: dayEnd,
    }),
  ])
  const readyCollections = preview.filter((collection) => collection.status === 'ready')
  const eventType = readyCollections.length > 0 ? await getValidatedRandomTestingCalcomEventType() : null
  const results: Array<{
    bookingId?: string
    calcomBookingUid?: string
    collectionKey: string
    error?: string
    placeholderCancelled?: boolean
    status: string
  }> = []

  for (const [ordinal, collection] of preview.entries()) {
    const reservationKey = `${collectionDate}:${ordinal}`
    const placeholder = calendarEvents.find(
      (event) =>
        metadataValue(event.metadata, 'source') === SOURCE &&
        metadataValue(event.metadata, 'kind') === 'placeholder' &&
        metadataValue(event.metadata, 'randomTestingReservationKey') === reservationKey,
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
      let calcomBooking = calcomBookings.find(
        (booking) =>
          isActiveCalcomBooking(booking) &&
          metadataValue(booking.metadata, 'source') === SOURCE &&
          metadataValue(booking.metadata, 'toxaccessCollectionKey') === collection.collectionKey,
      )
      if (!calcomBooking) {
        if (!eventType) throw new Error('The random-testing Cal.com event type was not validated.')
        const attendeePhone = formatPhoneForCal(client.phone)
        calcomBooking = await createCalcomBooking({
          attendee: {
            name: `${client.firstName} ${client.lastName}`,
            email: client.email,
            ...(attendeePhone ? { phoneNumber: attendeePhone } : {}),
            language: 'en',
            timeZone: timing.timeZone,
          },
          bookingFieldsResponses: {
            test: getTestTypeBookingLabel(client.defaultTestType) || collection.testType || 'Random Drug Test',
            title: collection.agency || 'Random Testing',
          },
          eventTypeId: eventType.id,
          metadata: {
            source: SOURCE,
            kind: 'scheduled-collection',
            randomTestingReservationKey: reservationKey,
            toxaccessCollectionKey: collection.collectionKey,
            toxaccessDonorId: collection.donorId,
            collectionDate,
            paymentStatus: 'unpaid',
          },
          start: timing.start,
        })
        calcomBookings.push(calcomBooking)
      }

      const bookingId = await ensurePayloadBooking({
        payload,
        calcomBooking,
        client: client as MatchingClient,
        collection,
        eventTypeId: eventType?.id || calcomBooking.eventTypeId || 0,
        ...timing,
      })
      let placeholderCancelled = false
      let status = 'materialized'
      let error: string | undefined

      if (placeholder) {
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
        calcomBookingUid: calcomBooking.uid,
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

  return { collectionDate, results }
}
