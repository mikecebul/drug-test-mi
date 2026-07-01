import { NextRequest, NextResponse } from 'next/server'
import { getPayload, type Payload } from 'payload'
import configPromise from '@payload-config'
import type { Booking } from '@/payload-types'
import { revalidateBookingViews } from '@/utilities/revalidateBookingViews'
import { findConfiguredTestTypeByCalcomAnswer } from '@/config/test-types'

import {
  allowsUnsignedCalcomWebhooks,
  buildCalcomBookingData,
  type CalcomBookingData,
  type CalcomWebhookPayload,
  getCalcomBookingNumericId,
  getCalcomBookingUid,
  getCalcomRescheduleUid,
  getCalcomScheduledTestAnswerCandidates,
  handledCalcomBookingEvents,
  verifyCalcomWebhookSignature,
} from './calcomWebhook'

function getWebhookSecret() {
  return process.env.CAL_WEBHOOK_SECRET || process.env.CALCOM_WEBHOOK_SECRET
}

async function findBookingByCalcomUid(payload: Payload, uid?: string | null): Promise<Booking | null> {
  if (!uid) return null

  const result = await payload.find({
    collection: 'bookings',
    where: {
      calcomBookingId: {
        equals: uid,
      },
    },
    limit: 1,
    overrideAccess: true,
  })

  return result.docs[0] || null
}

async function findBookingByCalcomNumericId(payload: Payload, numericId?: number | null): Promise<Booking | null> {
  if (!numericId) return null

  const result = await payload.find({
    collection: 'bookings',
    where: {
      calcomBookingNumericId: {
        equals: numericId,
      },
    },
    limit: 1,
    overrideAccess: true,
  })

  return result.docs[0] || null
}

async function updateBooking(payload: Payload, id: string, data: Partial<CalcomBookingData>, req: NextRequest) {
  const booking = await payload.update({
    collection: 'bookings',
    id,
    data,
    req,
    overrideAccess: true,
  })
  revalidateBookingViews()
  return booking
}

async function createBooking(payload: Payload, data: CalcomBookingData, req: NextRequest) {
  const booking = await payload.create({
    collection: 'bookings',
    data,
    req,
    overrideAccess: true,
  })
  revalidateBookingViews()
  return booking
}

function isDuplicateKeyError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false

  const maybeError = error as { code?: unknown; message?: unknown; cause?: unknown }
  if (maybeError.code === 11000) return true
  if (typeof maybeError.message === 'string' && /duplicate\s+key/i.test(maybeError.message)) return true

  return isDuplicateKeyError(maybeError.cause)
}

async function findBookingByCalcomIdentifiers(payload: Payload, data: CalcomBookingData): Promise<Booking | null> {
  const existingByUid = await findBookingByCalcomUid(payload, data.calcomBookingId)
  return existingByUid || (await findBookingByCalcomNumericId(payload, data.calcomBookingNumericId))
}

function getRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  return value as Record<string, unknown>
}

function resolveScheduledTestTypeValue(calcomPayload: CalcomWebhookPayload['payload'], fallbackInputs?: unknown) {
  const fallbackRecord = getRecord(fallbackInputs)
  const scheduledTestAnswers = getCalcomScheduledTestAnswerCandidates({
    ...calcomPayload,
    customInputs: calcomPayload.customInputs || fallbackRecord,
    responses: calcomPayload.responses || fallbackRecord,
  })
  if (scheduledTestAnswers.length === 0) return null

  for (const scheduledTestAnswer of scheduledTestAnswers) {
    const matchingTestType = findConfiguredTestTypeByCalcomAnswer(scheduledTestAnswer)
    if (matchingTestType) {
      return matchingTestType.value
    }
  }

  console.warn(`Cal.com scheduled test type did not match configured test types: ${scheduledTestAnswers.join(', ')}`)
  return null
}

function buildResolvedCalcomBookingData(
  webhookData: CalcomWebhookPayload,
  existingPayment?: Booking['payment'],
  existingBooking?: Booking | null,
) {
  const bookingData = buildCalcomBookingData(webhookData, existingPayment, existingBooking)
  const scheduledTestType = resolveScheduledTestTypeValue(webhookData.payload, bookingData.customInputs)

  if (scheduledTestType) {
    bookingData.scheduledTestType = scheduledTestType
  }

  return bookingData
}

async function createOrUpdateBooking(
  payload: Payload,
  data: CalcomBookingData,
  req: NextRequest,
): Promise<{ booking: Booking; created: boolean }> {
  try {
    const booking = await createBooking(payload, data, req)
    return { booking, created: true }
  } catch (error) {
    if (!isDuplicateKeyError(error) || (!data.calcomBookingId && !data.calcomBookingNumericId)) {
      throw error
    }

    const existingBooking = await findBookingByCalcomIdentifiers(payload, data)
    if (!existingBooking) {
      throw error
    }

    const booking = await updateBooking(payload, existingBooking.id, data, req)
    return { booking, created: false }
  }
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text()
    const signature = req.headers.get('x-cal-signature-256')
    const secret = getWebhookSecret()

    if (!verifyCalcomWebhookSignature(rawBody, signature, secret)) {
      if (!secret && !allowsUnsignedCalcomWebhooks()) {
        console.error('Cal.com webhook secret is not configured outside local development')
      } else {
        console.error('Invalid Cal.com webhook signature')
      }
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const webhookData = JSON.parse(rawBody) as CalcomWebhookPayload
    const { triggerEvent, payload } = webhookData

    console.log(`Received Cal.com webhook: ${triggerEvent}`)

    if (!handledCalcomBookingEvents.has(triggerEvent)) {
      return NextResponse.json({ message: 'Event type not handled' }, { status: 200 })
    }

    const payloadClient = await getPayload({ config: configPromise })
    const uid = getCalcomBookingUid(payload)
    const numericId = getCalcomBookingNumericId(payload)
    const rescheduleUid = getCalcomRescheduleUid(payload)
    const existingByUid = await findBookingByCalcomUid(payloadClient, uid)
    const existingByNumericId = existingByUid ? null : await findBookingByCalcomNumericId(payloadClient, numericId)
    const existingByRescheduleUid =
      triggerEvent === 'BOOKING_RESCHEDULED' ? await findBookingByCalcomUid(payloadClient, rescheduleUid) : null

    if (
      triggerEvent === 'BOOKING_RESCHEDULED' &&
      existingByUid &&
      existingByRescheduleUid &&
      existingByUid.id !== existingByRescheduleUid.id
    ) {
      await updateBooking(
        payloadClient,
        existingByRescheduleUid.id,
        {
          status: 'rescheduled',
          webhookData: webhookData as unknown as CalcomBookingData['webhookData'],
        },
        req,
      )

      const bookingData = buildResolvedCalcomBookingData(
        webhookData,
        existingByUid.payment,
        existingByUid,
      )
      const updatedBooking = await updateBooking(payloadClient, existingByUid.id, bookingData, req)

      console.log(`Merged Cal.com reschedule into existing booking: ${updatedBooking.id}`)
      return NextResponse.json({ message: 'Booking rescheduled', id: updatedBooking.id }, { status: 200 })
    }

    const existingBooking = existingByRescheduleUid || existingByUid || existingByNumericId
    const bookingData = buildResolvedCalcomBookingData(
      webhookData,
      existingBooking?.payment,
      existingBooking,
    )

    if (triggerEvent === 'BOOKING_CANCELLED' || triggerEvent === 'BOOKING_REJECTED') {
      if (existingBooking) {
        const updatedBooking = await updateBooking(payloadClient, existingBooking.id, bookingData, req)
        console.log(`Updated Cal.com booking status: ${updatedBooking.id}`)
        return NextResponse.json({ message: 'Booking status updated', id: updatedBooking.id }, { status: 200 })
      }

      const { booking, created } = await createOrUpdateBooking(payloadClient, bookingData, req)
      console.log(
        created
          ? `Created historical ${triggerEvent.toLowerCase()} booking: ${booking.id}`
          : `Recovered duplicate historical ${triggerEvent.toLowerCase()} booking: ${booking.id}`,
      )
      return NextResponse.json(
        { message: created ? 'Historical booking created' : 'Booking status updated', id: booking.id },
        { status: created ? 201 : 200 },
      )
    }

    if (existingBooking) {
      const updatedBooking = await updateBooking(payloadClient, existingBooking.id, bookingData, req)
      console.log(`Upserted Cal.com booking: ${updatedBooking.id}`)
      return NextResponse.json({ message: 'Booking updated', id: updatedBooking.id }, { status: 200 })
    }

    const { booking, created } = await createOrUpdateBooking(payloadClient, bookingData, req)
    console.log(
      created ? `Created Cal.com booking: ${booking.id}` : `Recovered duplicate Cal.com booking: ${booking.id}`,
    )
    return NextResponse.json(
      { message: created ? 'Booking created' : 'Booking updated', id: booking.id },
      { status: created ? 201 : 200 },
    )
  } catch (error) {
    console.error('Error processing Cal.com webhook:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
