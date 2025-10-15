import { NextRequest, NextResponse } from 'next/server'

/**
 * Test endpoint to simulate Cal.com webhook events in development
 *
 * Usage:
 * POST /api/test-calcom-webhook
 *
 * Body (optional):
 * {
 *   "triggerEvent": "BOOKING_CREATED" | "BOOKING_CANCELLED" | "BOOKING_RESCHEDULED",
 *   "email": "test@example.com",
 *   "name": "Test User",
 *   "phone": "(231) 555-1234",
 *   "isRecurring": false
 * }
 */
export async function POST(req: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'This endpoint is only available in development' },
      { status: 403 }
    )
  }

  try {
    const body = await req.json().catch(() => ({}))

    // Extract parameters or use defaults
    const {
      triggerEvent = 'BOOKING_CREATED',
      email = 'test@example.com',
      name = 'Test User',
      phone = '(231) 555-1234',
      isRecurring = false,
      testType = 'instant',
    } = body

    // Generate mock webhook payload
    const mockPayload = {
      triggerEvent,
      createdAt: new Date().toISOString(),
      payload: {
        type: 'Drug Test Appointment',
        title: isRecurring ? 'Recurring Drug Test Appointment' : 'Drug Test Appointment',
        description: `Mock ${testType === 'instant' ? 'Instant 15-Panel' : 'Lab 11-Panel'} test booking`,
        additionalNotes: 'This is a test booking created via the test webhook endpoint',
        customInputs: {},
        startTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
        endTime: new Date(Date.now() + 24 * 60 * 60 * 1000 + 30 * 60 * 1000).toISOString(), // Tomorrow + 30min
        organizer: {
          id: 1,
          name: 'MI Drug Test',
          email: 'info@drugtestmi.com',
          username: 'midrugtestorg',
          timeZone: 'America/Detroit',
          timeFormat: '12h',
          language: {
            locale: 'en',
          },
        },
        responses: {
          name: {
            label: 'Your name',
            value: name,
          },
          email: {
            label: 'Your email',
            value: email,
          },
          phone: {
            label: 'Phone number',
            value: phone,
          },
          location: {
            label: 'Location',
            value: {
              optionValue: '201 State Street, Lower Level, Charlevoix',
              value: '201 State Street, Lower Level, Charlevoix',
            },
          },
        },
        uid: `test_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        eventTypeId: isRecurring ? 2 : 1,
        bookerUrl: `https://cal.com/mike-midrugtest/drug-test`,
        attendees: [
          {
            name,
            email,
            timeZone: 'America/Detroit',
          },
        ],
        location: '201 State Street, Lower Level, Charlevoix',
        // Add recurring fields if needed
        ...(isRecurring && {
          recurringBookingUid: `recurring_${Date.now()}`,
          recurrence: {
            freq: 'WEEKLY',
            interval: 1,
            count: 12,
          },
        }),
      },
    }

    // Forward to the actual webhook handler
    const webhookUrl = new URL('/api/webhooks/calcom', req.url)

    console.log('🧪 Sending mock Cal.com webhook event:')
    console.log(`   Event: ${triggerEvent}`)
    console.log(`   Email: ${email}`)
    console.log(`   Phone: ${phone}`)
    console.log(`   Recurring: ${isRecurring}`)
    console.log(`   Test Type: ${testType}`)

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Skip signature verification in development
      },
      body: JSON.stringify(mockPayload),
    })

    const result = await response.json()

    if (!response.ok) {
      console.error('❌ Webhook handler error:', result)
      return NextResponse.json(
        {
          error: 'Webhook handler failed',
          details: result,
          mockPayload,
        },
        { status: response.status }
      )
    }

    console.log('✅ Mock webhook processed successfully')

    return NextResponse.json({
      success: true,
      message: 'Mock webhook sent successfully',
      triggerEvent,
      bookingDetails: {
        email,
        name,
        phone,
        isRecurring,
        testType,
      },
      webhookResponse: result,
    })
  } catch (error) {
    console.error('Error in test webhook endpoint:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// GET endpoint to show usage instructions
export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'This endpoint is only available in development' },
      { status: 403 }
    )
  }

  return NextResponse.json({
    name: 'Cal.com Webhook Test Endpoint',
    description: 'Simulates Cal.com webhook events for development testing',
    usage: {
      method: 'POST',
      url: '/api/test-calcom-webhook',
      body: {
        triggerEvent: 'BOOKING_CREATED | BOOKING_CANCELLED | BOOKING_RESCHEDULED (default: BOOKING_CREATED)',
        email: 'Email address (default: test@example.com)',
        name: 'Full name (default: Test User)',
        phone: 'Phone number (default: (231) 555-1234)',
        isRecurring: 'Boolean (default: false)',
        testType: 'instant | lab (default: instant)',
      },
    },
    examples: [
      {
        description: 'Create a one-time booking',
        body: {
          triggerEvent: 'BOOKING_CREATED',
          email: 'john@example.com',
          name: 'John Doe',
          phone: '(231) 555-0100',
          isRecurring: false,
          testType: 'instant',
        },
      },
      {
        description: 'Create a recurring booking',
        body: {
          triggerEvent: 'BOOKING_CREATED',
          email: 'jane@example.com',
          name: 'Jane Smith',
          phone: '(231) 555-0200',
          isRecurring: true,
          testType: 'lab',
        },
      },
      {
        description: 'Cancel a booking (use existing booking UID)',
        body: {
          triggerEvent: 'BOOKING_CANCELLED',
          email: 'john@example.com',
          name: 'John Doe',
          phone: '(231) 555-0100',
        },
      },
    ],
    curlExamples: [
      'curl -X POST http://localhost:3000/api/test-calcom-webhook -H "Content-Type: application/json" -d \'{"email": "test@example.com", "name": "Test User", "phone": "(231) 555-1234"}\'',
      'curl -X POST http://localhost:3000/api/test-calcom-webhook -H "Content-Type: application/json" -d \'{"isRecurring": true, "testType": "lab"}\'',
    ],
  })
}
