import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { NextRequest, NextResponse } from 'next/server'

const TEST_TYPES = [
  {
    value: '11-panel-lab',
    label: '11-Panel Lab',
    bookingLabel: '11 Panel Lab',
    category: 'lab' as const,
    price: 40,
    toxAccessCode: 'B729',
  },
  {
    value: '11-panel-lab-no-etg',
    label: '11-Panel Lab (no EtG)',
    bookingLabel: '11 Panel Lab (no EtG)',
    category: 'lab' as const,
    price: 40,
    toxAccessCode: 'B829',
  },
  {
    value: '15-panel-instant',
    label: '15-Panel Instant',
    bookingLabel: '15 Panel Instant',
    category: 'instant' as const,
    price: 35,
  },
  {
    value: '17-panel-instant',
    label: '17-Panel Instant',
    bookingLabel: '17 Panel Instant',
    category: 'instant' as const,
    price: 35,
  },
  {
    value: '17-panel-sos-lab',
    label: '17-Panel SOS Lab',
    bookingLabel: '17 SOS Lab',
    category: 'lab' as const,
    price: 45,
  },
  {
    value: 'etg-lab',
    label: 'EtG Lab',
    bookingLabel: 'EtG Lab',
    category: 'lab' as const,
    price: 40,
  },
]

function todayAt(hour: number, minute = 0) {
  const date = new Date()
  date.setHours(hour, minute, 0, 0)
  return date
}

async function ensureTestType(payload: Awaited<ReturnType<typeof getPayload>>, value: string) {
  const testType = TEST_TYPES.find((entry) => entry.value === value)
  if (!testType) throw new Error(`Unknown test type: ${value}`)

  const existing = await payload.find({
    collection: 'test-types',
    where: {
      value: {
        equals: value,
      },
    },
    depth: 0,
    limit: 1,
    overrideAccess: true,
  })

  if (existing.docs[0]) {
    const updated = await payload.update({
      collection: 'test-types',
      id: existing.docs[0].id,
      data: testType,
      overrideAccess: true,
    })
    return updated.id
  }

  const created = await payload.create({
    collection: 'test-types',
    data: {
      ...testType,
      isActive: true,
    },
    overrideAccess: true,
  })

  return created.id
}

async function ensureReferral(
  payload: Awaited<ReturnType<typeof getPayload>>,
  collection: 'courts' | 'employers',
  name: string,
  preferredTestType: string,
) {
  const preferredTestTypeId = await ensureTestType(payload, preferredTestType)
  const existing = await payload.find({
    collection,
    where: {
      name: {
        equals: name,
      },
    },
    depth: 0,
    limit: 1,
    overrideAccess: true,
  })

  const data = {
    name,
    preferredTestType: preferredTestTypeId,
    contacts: [
      {
        name: 'Mock Referral Contact',
        email: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '.')}@example.com`,
      },
    ],
    isActive: true,
  }

  if (existing.docs[0]) {
    const updated = await payload.update({
      collection,
      id: existing.docs[0].id,
      data,
      overrideAccess: true,
    })
    return updated.id
  }

  const created = await payload.create({
    collection,
    data,
    overrideAccess: true,
  })

  return created.id
}

async function ensureClient(
  payload: Awaited<ReturnType<typeof getPayload>>,
  input: {
    firstName: string
    lastName: string
    email: string
    phone: string
    referralType: 'court' | 'employer'
    referral: {
      relationTo: 'courts' | 'employers'
      value: string
    }
  },
) {
  const existing = await payload.find({
    collection: 'clients',
    where: {
      email: {
        equals: input.email,
      },
    },
    depth: 0,
    limit: 1,
    overrideAccess: true,
  })

  const data = {
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    password: 'MockTesting123',
    phone: input.phone,
    dob: '1990-01-01T00:00:00.000Z',
    gender: 'prefer-not-to-say' as const,
    referralType: input.referralType,
    referral: input.referral,
    preferredContactMethod: 'email' as const,
    _verified: true,
    isActive: true,
  }

  if (existing.docs[0]) {
    const updated = await payload.update({
      collection: 'clients',
      id: existing.docs[0].id,
      data,
      overrideAccess: true,
    })
    return updated.id
  }

  const created = await payload.create({
    collection: 'clients',
    data,
    overrideAccess: true,
  })

  return created.id
}

async function createTodayMockBookings(payload: Awaited<ReturnType<typeof getPayload>>) {
  const courtId = await ensureReferral(payload, 'courts', 'Mock 90th District Court', '11-panel-lab')
  const employerId = await ensureReferral(payload, 'employers', 'Mock Harbor Manufacturing', '17-panel-instant')
  const sosEmployerId = await ensureReferral(payload, 'employers', 'Mock SOS Program', '17-panel-sos-lab')

  const registeredCourtClientId = await ensureClient(payload, {
    firstName: 'Avery',
    lastName: 'Stone',
    email: 'mock.avery.stone@example.com',
    phone: '2315550101',
    referralType: 'court',
    referral: {
      relationTo: 'courts',
      value: courtId,
    },
  })

  const registeredEmployerClientId = await ensureClient(payload, {
    firstName: 'Blake',
    lastName: 'Reed',
    email: 'mock.blake.reed@example.com',
    phone: '2315550102',
    referralType: 'employer',
    referral: {
      relationTo: 'employers',
      value: employerId,
    },
  })

  const registeredSosClientId = await ensureClient(payload, {
    firstName: 'Casey',
    lastName: 'Brooks',
    email: 'mock.casey.brooks@example.com',
    phone: '2315550103',
    referralType: 'employer',
    referral: {
      relationTo: 'employers',
      value: sosEmployerId,
    },
  })

  await payload.delete({
    collection: 'bookings',
    where: {
      calcomBookingId: {
        contains: 'mock-today-',
      },
    },
    overrideAccess: true,
  })

  const rows = [
    {
      attendeeName: 'Avery Stone',
      attendeeEmail: 'mock.avery.stone@example.com',
      attendeePhone: '2315550101',
      start: todayAt(9, 0),
      title: 'Mock Court Lab Collection',
      relatedClient: registeredCourtClientId,
    },
    {
      attendeeName: 'Blake Reed',
      attendeeEmail: 'mock.blake.reed@example.com',
      attendeePhone: '2315550102',
      start: todayAt(10, 15),
      title: 'Mock Employer Instant Screen',
      relatedClient: registeredEmployerClientId,
    },
    {
      attendeeName: 'Casey Brooks',
      attendeeEmail: 'mock.casey.brooks@example.com',
      attendeePhone: '2315550103',
      start: todayAt(11, 30),
      title: 'Mock SOS Lab Collection',
      relatedClient: registeredSosClientId,
    },
    {
      attendeeName: 'Devon Carter',
      attendeeEmail: 'mock.devon.carter@example.com',
      attendeePhone: '2315550104',
      start: todayAt(13, 0),
      title: 'Mock First-Time Client',
      relatedClient: null,
    },
    {
      attendeeName: 'Emery Lane',
      attendeeEmail: 'mock.emery.lane@example.com',
      attendeePhone: '2315550105',
      start: todayAt(14, 15),
      title: 'Mock Unregistered Referral Needed',
      relatedClient: null,
    },
  ]

  const created: Array<{
    id: string
    attendeeName: string
    attendeeEmail: string
    startTime: string
    relatedClient: unknown
  }> = []

  for (let index = 0; index < rows.length; index++) {
    const row = rows[index]
    const end = new Date(row.start.getTime() + 30 * 60 * 1000)
    const booking = await payload.create({
      collection: 'bookings',
      data: {
        title: row.title,
        type: '30min',
        description: 'Development mock booking for complete workflow testing',
        additionalNotes: 'Created by /api/test-booking?type=today',
        startTime: row.start.toISOString(),
        endTime: end.toISOString(),
        status: 'confirmed',
        attendeeName: row.attendeeName,
        attendeeEmail: row.attendeeEmail,
        relatedClient: row.relatedClient,
        location: 'Charlevoix Office',
        organizer: {
          id: 123,
          name: 'Mock Technician',
          email: 'mock.tech@midrugtest.com',
          username: 'mocktech',
          timeZone: 'America/Detroit',
          timeFormat: '12',
        },
        calcomBookingId: `mock-today-${index + 1}`,
        eventTypeId: 456,
        customInputs: {
          phone: row.attendeePhone,
          testingReason: row.relatedClient ? 'Existing client workflow test' : 'First-time client workflow test',
        },
        webhookData: {
          test: true,
          type: 'today',
          created_at: new Date().toISOString(),
        },
        createdViaWebhook: false,
      },
      overrideAccess: true,
    })

    created.push({
      id: booking.id,
      attendeeName: booking.attendeeName,
      attendeeEmail: booking.attendeeEmail,
      startTime: booking.startTime,
      relatedClient: booking.relatedClient,
    })
  }

  return created
}

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
      case 'today': {
        const bookings = await createTodayMockBookings(payload)

        return NextResponse.json({
          success: true,
          message: 'Created 5 mock bookings for today',
          type: 'today',
          bookings,
        })
      }

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
      'POST /api/test-booking?type=today': 'Reset and create 5 mock bookings for today',
    },
    note: 'This will trigger the syncClient hook to create/update clients automatically',
    environment: 'development'
  })
}
