import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { NextRequest, NextResponse } from 'next/server'
import type { RequiredDataFromCollectionSlug } from 'payload'
import { getTestTypeByValue } from '@/config/test-types'

type Payload = Awaited<ReturnType<typeof getPayload>>
type BookingData = RequiredDataFromCollectionSlug<'bookings'>

function todayAt(hour: number, minute = 0) {
  const date = new Date()
  date.setHours(hour, minute, 0, 0)
  return date
}

async function authorizeTestBookingRequest(payload: Payload, request: NextRequest) {
  if (process.env.NODE_ENV === 'development') return null

  const { user } = await payload.auth({ headers: request.headers })

  if (!user) {
    return NextResponse.json(
      {
        success: false,
        error: 'Authentication required',
      },
      { status: 401 },
    )
  }

  if (user.collection !== 'admins') {
    return NextResponse.json(
      {
        success: false,
        error: 'Admin account required',
      },
      { status: 403 },
    )
  }

  return null
}

function buildMockCalcomFields(uid: string, numericId: number, overrides: Partial<BookingData> = {}): Partial<BookingData> {
  return {
    calcomBookingId: uid,
    calcomBookingNumericId: numericId,
    calcomRescheduledFromId: null,
    calcomPaymentId: null,
    eventTypeId: 456,
    createdViaWebhook: false,
    ...overrides,
  }
}

async function ensureReferral(
  payload: Payload,
  collection: 'courts' | 'employers',
  name: string,
  preferredTestType: string,
) {
  const configuredTestType = getTestTypeByValue(preferredTestType)
  if (!configuredTestType?.isActive) throw new Error(`Unknown active test type: ${preferredTestType}`)

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
    preferredTestType: configuredTestType.value,
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
  payload: Payload,
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

async function createTodayMockBookings(payload: Payload) {
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
        ...buildMockCalcomFields(`mock-today-${index + 1}`, 900_001 + index),
        customInputs: {
          phone: row.attendeePhone,
          testingReason: row.relatedClient ? 'Existing client workflow test' : 'First-time client workflow test',
        },
        webhookData: {
          test: true,
          type: 'today',
          uid: `mock-today-${index + 1}`,
          id: 900_001 + index,
          created_at: new Date().toISOString(),
        },
        payment: {
          amountDue: 35,
          amountPaid: 0,
          method: 'not-paid',
          status: 'unpaid',
        },
        sampleCollection: {
          status: 'pending',
        },
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
  try {
    const payload = await getPayload({ config: configPromise })
    const unauthorizedResponse = await authorizeTestBookingRequest(payload, request)
    if (unauthorizedResponse) return unauthorizedResponse

    // Get query params for customization
    const { searchParams } = new URL(request.url)
    const testType = searchParams.get('type') || 'new' // 'new', 'existing', 'multiple'

    let mockBookingData: BookingData

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
          description: '17 panel instant drug test',
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
          ...buildMockCalcomFields(`test-booking-${Date.now()}`, Date.now()),
          customInputs: {
            reason: 'Follow-up testing',
            special_instructions: 'Rush results needed',
          },
          webhookData: {
            test: true,
            type: 'existing',
            created_at: new Date().toISOString(),
          },
          payment: {
            amountDue: 35,
            amountPaid: 35,
            method: 'pre-paid',
            status: 'paid',
            notes: 'Mock prepaid Cal.com booking',
          },
          sampleCollection: {
            status: 'pending',
          },
        }
        break

      case 'multiple':
        // Create multiple bookings for the same client
        const baseTime = Date.now() + 48 * 60 * 60 * 1000 // Day after tomorrow

        for (let i = 0; i < 3; i++) {
          const bookingTime = new Date(baseTime + i * 2 * 60 * 60 * 1000) // 2 hours apart

          const uid = `test-multiple-${Date.now()}-${i}`

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
              ...buildMockCalcomFields(uid, 910_001 + i),
              customInputs: {
                reason: `Multiple test ${i + 1}`,
              },
              webhookData: {
                test: true,
                type: 'multiple',
                uid,
                id: 910_001 + i,
                created_at: new Date().toISOString(),
              },
              payment: {
                amountDue: 35,
                amountPaid: 0,
                method: 'not-paid',
                status: 'unpaid',
              },
              sampleCollection: {
                status: 'pending',
              },
            },
            overrideAccess: true,
          })
        }

        return NextResponse.json({
          success: true,
          message: 'Created 3 test bookings for Sarah Johnson',
          type: 'multiple',
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
          ...buildMockCalcomFields(`test-booking-${Date.now()}`, Date.now()),
          customInputs: {
            reason: 'Pre-employment screening',
            company: 'Test Company Inc.',
          },
          webhookData: {
            test: true,
            type: 'new',
            created_at: new Date().toISOString(),
          },
          payment: {
            amountDue: 35,
            amountPaid: 0,
            method: 'not-paid',
            status: 'unpaid',
          },
          sampleCollection: {
            status: 'pending',
          },
        }
    }

    // Create the booking (this will trigger the syncClient hook)
    const booking = await payload.create({
      collection: 'bookings',
      data: mockBookingData,
      overrideAccess: true,
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
      overrideAccess: true,
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
      client:
        client.docs.length > 0
          ? {
              id: client.docs[0].id,
              name: client.docs[0].fullName,
              email: client.docs[0].email,
            }
          : null,
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
      { status: 500 },
    )
  }
}

export async function GET(request: NextRequest) {
  const payload = await getPayload({ config: configPromise })
  const unauthorizedResponse = await authorizeTestBookingRequest(payload, request)
  if (unauthorizedResponse) return unauthorizedResponse

  return NextResponse.json({
    message: 'Test Booking API',
    authorization: 'Development environment or authenticated Payload admin account required',
    usage: {
      'POST /api/test-booking': 'Create a test booking with new client',
      'POST /api/test-booking?type=new': 'Create booking for new client (Jane Doe)',
      'POST /api/test-booking?type=existing': 'Create booking for existing client (John Smith)',
      'POST /api/test-booking?type=multiple': 'Create 3 bookings for same client (Sarah Johnson)',
      'POST /api/test-booking?type=today': 'Reset and create 5 mock bookings for today',
    },
    note: 'This will trigger the syncClient hook to create/update clients automatically',
    environment: 'development',
  })
}
