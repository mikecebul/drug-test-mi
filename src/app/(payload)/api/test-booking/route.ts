import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  // Disable in production to prevent abuse
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      {
        success: false,
        error: 'Test booking API is disabled in production',
      },
      { status: 403 }
    )
  }

  try {
    const payload = await getPayload({ config: configPromise })
    
    // Get query params for customization
    const { searchParams } = new URL(request.url)
    const testType = searchParams.get('type') || 'new' // 'new', 'existing', 'multiple'
    
    let mockBookingData
    
    switch (testType) {
      case 'existing':
        // Test with existing client email
        mockBookingData = {
          title: 'Instant Drug Test',
          type: 'Instant Drug Test',
          description: '15 panel drug test',
          startTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
          endTime: new Date(Date.now() + 24 * 60 * 60 * 1000 + 10 * 60 * 1000).toISOString(), // Tomorrow + 10min
          status: 'confirmed',
          attendeeName: 'Michael Cebulski',
          attendeeEmail: 'dev4@mikecebul.dev', // Same email as previous booking
          location: 'Charlevoix Office',
          organizer: {
            id: 123,
            name: 'Mike Rodriguez',
            email: 'mike@midrugtest.com',
            username: 'mikerodriguez',
            timeZone: 'America/Detroit',
            timeFormat: '12',
          },
          calcomBookingId: `test-booking-${Date.now()}`,
          eventTypeId: 456,
          customInputs: {
            reason: 'Follow-up testing',
            special_instructions: 'Rush results needed'
          },
          createdViaWebhook: false, // Mark as test
        }
        break
        
      case 'multiple':
        // Create multiple bookings for the same client
        const baseTime = Date.now() + 48 * 60 * 60 * 1000 // Day after tomorrow
        
        for (let i = 0; i < 3; i++) {
          const bookingTime = new Date(baseTime + i * 2 * 60 * 60 * 1000) // 2 hours apart
          
          await payload.create({
            collection: 'bookings',
            data: {
              title: `Drug Test Appointment ${i + 1}`,
              type: '30min',
              description: `Test appointment ${i + 1}`,
              startTime: bookingTime.toISOString(),
              endTime: new Date(bookingTime.getTime() + 30 * 60 * 1000).toISOString(),
              status: 'confirmed',
              attendeeName: 'Sarah Johnson',
              attendeeEmail: 'sarah.johnson@company.com',
              location: 'Charlevoix Office',
              organizer: {
                id: 123,
                name: 'Sarah Johnson',
                email: 'sarah@midrugtest.com',
                username: 'sarahjohnson',
                timeZone: 'America/Detroit',
                timeFormat: '12',
              },
              calcomBookingId: `test-multiple-${Date.now()}-${i}`,
              eventTypeId: 456,
              customInputs: {
                reason: `Multiple test ${i + 1}`,
              },
              createdViaWebhook: false,
            },
          })
        }
        
        return NextResponse.json({
          success: true,
          message: 'Created 3 test bookings for Sarah Johnson',
          type: 'multiple'
        })
        
      default: // 'new'
        mockBookingData = {
          title: 'Drug Test Appointment',
          type: '30min',
          description: 'Initial drug testing appointment',
          startTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours from now
          endTime: new Date(Date.now() + 2 * 60 * 60 * 1000 + 30 * 60 * 1000).toISOString(), // 2.5 hours from now
          status: 'confirmed',
          attendeeName: 'Jane Doe',
          attendeeEmail: 'jane.doe@newclient.com',
          location: 'Charlevoix Office',
          organizer: {
            id: 123,
            name: 'John Smith',
            email: 'john@midrugtest.com',
            username: 'johnsmith',
            timeZone: 'America/Detroit',
            timeFormat: '12',
          },
          calcomBookingId: `test-booking-${Date.now()}`,
          eventTypeId: 456,
          customInputs: {
            reason: 'Pre-employment screening',
            company: 'Test Company Inc.'
          },
          webhookData: {
            test: true,
            created_at: new Date().toISOString()
          },
          createdViaWebhook: false, // Mark as test so we can identify it
        }
    }
    
    // Create the booking (this will trigger the syncClient hook)
    const booking = await payload.create({
      collection: 'bookings',
      data: mockBookingData,
    })
    
    // Check if client was created/updated
    const client = await payload.find({
      collection: 'clients',
      where: {
        email: {
          equals: mockBookingData.attendeeEmail,
        },
      },
      limit: 1,
    })
    
    return NextResponse.json({
      success: true,
      message: 'Test booking created successfully',
      booking: {
        id: booking.id,
        title: booking.title,
        attendeeName: booking.attendeeName,
        attendeeEmail: booking.attendeeEmail,
        startTime: booking.startTime,
      },
      client: client.docs.length > 0 ? {
        id: client.docs[0].id,
        name: client.docs[0].fullName,
        email: client.docs[0].email,
      } : null,
      type: testType,
    })
    
  } catch (error) {
    console.error('Test booking creation failed:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create test booking',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  // Disable in production to prevent abuse
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      {
        success: false,
        error: 'Test booking API is disabled in production',
      },
      { status: 403 }
    )
  }

  return NextResponse.json({
    message: 'Test Booking API',
    usage: {
      'POST /api/test-booking': 'Create a test booking with new client',
      'POST /api/test-booking?type=new': 'Create booking for new client (Jane Doe)',
      'POST /api/test-booking?type=existing': 'Create booking for existing client (John Smith)',
      'POST /api/test-booking?type=multiple': 'Create 3 bookings for same client (Sarah Johnson)',
    },
    note: 'This will trigger the syncClient hook to create/update clients automatically',
    environment: 'development'
  })
}