import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { cancelCalcomBooking } from '@/lib/calcom'

export async function POST(req: NextRequest) {
  try {
    const { bookingId, calcomBookingId, cancellationReason } = await req.json()

    if (!bookingId || !cancellationReason) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const payload = await getPayload({ config: configPromise })

    // Get the booking
    const booking = await payload.findByID({
      collection: 'bookings',
      id: bookingId,
    })

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    // Cancel on Cal.com if we have a calcomBookingId
    if (calcomBookingId) {
      try {
        await cancelCalcomBooking(calcomBookingId, cancellationReason)
        console.log(`✓ Cancelled Cal.com booking: ${calcomBookingId}`)
      } catch (error) {
        console.error('Error cancelling on Cal.com:', error)
        // Continue to update local status even if Cal.com fails
      }
    }

    // Update the booking status in Payload
    await payload.update({
      collection: 'bookings',
      id: bookingId,
      data: {
        status: 'cancelled',
        additionalNotes: `Cancelled: ${cancellationReason}${booking.additionalNotes ? `\n\n${booking.additionalNotes}` : ''}`,
      },
    })

    console.log(`✓ Updated local booking status to cancelled: ${bookingId}`)

    return NextResponse.json({
      message: 'Booking cancelled successfully',
      bookingId,
    })
  } catch (error) {
    console.error('Error in cancel booking API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
