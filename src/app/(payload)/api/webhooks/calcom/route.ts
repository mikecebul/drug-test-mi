import { NextRequest, NextResponse } from 'next/server'
import { getPayload, type Payload } from 'payload'
import configPromise from '@payload-config'
import type { Booking } from '@/payload-types'
import { revalidateBookingViews } from '@/utilities/revalidateBookingViews'

import {
  buildCalcomBookingData,
  type CalcomBookingData,
  type CalcomWebhookPayload,
  getCalcomBookingNumericId,
  getCalcomBookingUid,
  getCalcomRescheduleUid,
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

async function updateBooking(
  payload: Payload,
  id: string,
  data: Partial<CalcomBookingData>,
  req: NextRequest,
) {
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

async function createBooking(
  payload: Payload,
  data: CalcomBookingData,
  req: NextRequest,
) {
  const booking = await payload.create({
    collection: 'bookings',
    data,
    req,
    overrideAccess: true,
  })
  revalidateBookingViews()
  return booking
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text()
    const signature = req.headers.get('x-cal-signature-256')
    const secret = getWebhookSecret()

    if (!verifyCalcomWebhookSignature(rawBody, signature, secret)) {
      console.error('Invalid Cal.com webhook signature')
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

    if (triggerEvent === 'BOOKING_RESCHEDULED' && existingByUid && existingByRescheduleUid && existingByUid.id !== existingByRescheduleUid.id) {
      await updateBooking(
        payloadClient,
        existingByRescheduleUid.id,
        {
          status: 'rescheduled',
          webhookData: webhookData as unknown as CalcomBookingData['webhookData'],
        },
        req,
      )

      const bookingData = buildCalcomBookingData(webhookData, existingByUid.payment)
      const updatedBooking = await updateBooking(payloadClient, existingByUid.id, bookingData, req)

      console.log(`Merged Cal.com reschedule into existing booking: ${updatedBooking.id}`)
      return NextResponse.json({ message: 'Booking rescheduled', id: updatedBooking.id }, { status: 200 })
    }

    const existingBooking = existingByRescheduleUid || existingByUid || existingByNumericId
    const bookingData = buildCalcomBookingData(webhookData, existingBooking?.payment)

    if (triggerEvent === 'BOOKING_CANCELLED' || triggerEvent === 'BOOKING_REJECTED') {
      if (existingBooking) {
        const updatedBooking = await updateBooking(payloadClient, existingBooking.id, bookingData, req)
        console.log(`Updated Cal.com booking status: ${updatedBooking.id}`)
        return NextResponse.json({ message: 'Booking status updated', id: updatedBooking.id }, { status: 200 })
      }

      const booking = await createBooking(payloadClient, bookingData, req)
      console.log(`Created historical ${triggerEvent.toLowerCase()} booking: ${booking.id}`)
      return NextResponse.json({ message: 'Historical booking created', id: booking.id }, { status: 201 })
    }

    if (existingBooking) {
      const updatedBooking = await updateBooking(payloadClient, existingBooking.id, bookingData, req)
      console.log(`Upserted Cal.com booking: ${updatedBooking.id}`)
      return NextResponse.json({ message: 'Booking updated', id: updatedBooking.id }, { status: 200 })
    }

    const booking = await createBooking(payloadClient, bookingData, req)
    console.log(`Created Cal.com booking: ${booking.id}`)
    return NextResponse.json({ message: 'Booking created', id: booking.id }, { status: 201 })
  } catch (error) {
    console.error('Error processing Cal.com webhook:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
