import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import crypto from 'crypto'

interface CalcomWebhookPayload {
  triggerEvent: 'BOOKING_CREATED' | 'BOOKING_CANCELLED' | 'BOOKING_RESCHEDULED' | 'BOOKING_REJECTED' | 'BOOKING_REQUESTED' | 'BOOKING_PAID' | 'MEETING_STARTED' | 'MEETING_ENDED' | 'RECORDING_READY' | 'FORM_SUBMITTED' | 'INSTANT_MEETING_CREATED'
  createdAt: string
  payload: {
    type: string
    title: string
    description?: string
    additionalNotes?: string
    customInputs?: Record<string, any>
    startTime: string
    endTime: string
    organizer: {
      id: number
      name: string
      email: string
      username?: string
      timeZone?: string
      timeFormat?: string
      language?: {
        locale: string
      }
    }
    responses: {
      name?: {
        label: string
        value: string
      }
      email?: {
        label: string
        value: string
      }
      location?: {
        label: string
        value: string | { optionValue: string; value: string }
      }
      [key: string]: any
    }
    uid?: string
    eventTypeId?: number
    bookerUrl?: string
    attendees?: Array<{
      name: string
      email: string
      timeZone: string
    }>
    location?: string
    destinationCalendar?: any
    hideCalendarNotes?: boolean
    requiresConfirmation?: boolean
    seatsShowAttendees?: boolean
    seatsPerTimeSlot?: number
    seatsShowAvailabilityCount?: boolean
    schedulingType?: string
    iCalUID?: string
    iCalSequence?: number
    conferenceData?: any
  }
}

function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  if (!signature || !secret) return true
  
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
  
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  )
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text()
    const signature = req.headers.get('x-cal-signature-256')
    const secret = process.env.CALCOM_WEBHOOK_SECRET

    if (secret && signature) {
      const isValid = verifyWebhookSignature(rawBody, signature, secret)
      if (!isValid) {
        console.error('Invalid Cal.com webhook signature')
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }
    }

    const webhookData: CalcomWebhookPayload = JSON.parse(rawBody)
    const { triggerEvent, payload } = webhookData

    console.log(`Received Cal.com webhook: ${triggerEvent}`)

    if (!['BOOKING_CREATED', 'BOOKING_CANCELLED', 'BOOKING_RESCHEDULED'].includes(triggerEvent)) {
      return NextResponse.json({ message: 'Event type not handled' }, { status: 200 })
    }

    const payloadInstance = await getPayload({ config: configPromise })

    const attendeeName = payload.responses?.name?.value || 'Unknown'
    const attendeeEmail = payload.responses?.email?.value || ''
    const locationValue = payload.responses?.location?.value
    const location = typeof locationValue === 'string' 
      ? locationValue 
      : typeof locationValue === 'object' 
      ? locationValue.value || locationValue.optionValue
      : ''

    const bookingData = {
      title: payload.title,
      type: payload.type,
      description: payload.description || null,
      additionalNotes: payload.additionalNotes || null,
      startTime: payload.startTime,
      endTime: payload.endTime,
      status: triggerEvent === 'BOOKING_CANCELLED' ? 'cancelled' as const : 'confirmed' as const,
      organizer: {
        id: payload.organizer.id || null,
        name: payload.organizer.name,
        email: payload.organizer.email,
        username: payload.organizer.username || null,
        timeZone: payload.organizer.timeZone || null,
        timeFormat: payload.organizer.timeFormat || null,
      },
      attendeeName,
      attendeeEmail,
      location: location || null,
      calcomBookingId: payload.uid || null,
      eventTypeId: payload.eventTypeId || null,
      customInputs: payload.customInputs || null,
      webhookData: webhookData as any,
      createdViaWebhook: true,
    }

    if (triggerEvent === 'BOOKING_CREATED') {
      const booking = await payloadInstance.create({
        collection: 'bookings',
        data: bookingData,
        req,
      })
      
      console.log(`Created booking: ${booking.id}`)
      return NextResponse.json({ message: 'Booking created', id: booking.id }, { status: 201 })
      
    } else if (triggerEvent === 'BOOKING_CANCELLED') {
      try {
        const existingBooking = await payloadInstance.find({
          collection: 'bookings',
          where: {
            calcomBookingId: {
              equals: payload.uid,
            },
          },
          limit: 1,
        })

        if (existingBooking.docs.length > 0) {
          await payloadInstance.update({
            collection: 'bookings',
            id: existingBooking.docs[0].id,
            data: {
              status: 'cancelled',
              webhookData: webhookData as any,
            },
            req,
          })
          
          console.log(`Updated booking status to cancelled: ${existingBooking.docs[0].id}`)
          return NextResponse.json({ message: 'Booking cancelled' }, { status: 200 })
        } else {
          const booking = await payloadInstance.create({
            collection: 'bookings',
            data: bookingData,
            req,
          })
          
          console.log(`Created cancelled booking: ${booking.id}`)
          return NextResponse.json({ message: 'Cancelled booking created', id: booking.id }, { status: 201 })
        }
      } catch (error) {
        console.error('Error handling booking cancellation:', error)
        return NextResponse.json({ error: 'Error processing cancellation' }, { status: 500 })
      }
      
    } else if (triggerEvent === 'BOOKING_RESCHEDULED') {
      try {
        const existingBooking = await payloadInstance.find({
          collection: 'bookings',
          where: {
            calcomBookingId: {
              equals: payload.uid,
            },
          },
          limit: 1,
        })

        if (existingBooking.docs.length > 0) {
          await payloadInstance.update({
            collection: 'bookings',
            id: existingBooking.docs[0].id,
            data: {
              ...bookingData,
              status: 'confirmed',
            },
            req,
          })
          
          console.log(`Rescheduled booking: ${existingBooking.docs[0].id}`)
          return NextResponse.json({ message: 'Booking rescheduled' }, { status: 200 })
        } else {
          const booking = await payloadInstance.create({
            collection: 'bookings',
            data: bookingData,
            req,
          })
          
          console.log(`Created rescheduled booking: ${booking.id}`)
          return NextResponse.json({ message: 'Rescheduled booking created', id: booking.id }, { status: 201 })
        }
      } catch (error) {
        console.error('Error handling booking reschedule:', error)
        return NextResponse.json({ error: 'Error processing reschedule' }, { status: 500 })
      }
    }

    // Fallback return in case none of the conditions match
    return NextResponse.json({ message: 'Event processed' }, { status: 200 })

  } catch (error) {
    console.error('Error processing Cal.com webhook:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}