'use server'

import { getPayload } from 'payload'
import config from '@payload-config'
import type { Client, Court, Employer, TestType } from '@/payload-types'
import { APP_TIMEZONE } from '@/lib/date-utils'
import { TZDate } from '@date-fns/tz'
import { revalidateBookingViews } from '@/utilities/revalidateBookingViews'

type TestTypeValue = '11-panel-lab' | '11-panel-lab-no-etg' | '17-panel-instant' | '17-panel-sos-lab' | 'etg-lab'

type PaymentStatus = 'paid' | 'partial' | 'unpaid'
type PaymentMethod = 'cash' | 'card' | 'not-paid' | 'pre-paid'
type PopulatedReferral = Court | Employer
type PopulatedClient = Client & {
  referral?: {
    relationTo?: 'courts' | 'employers'
    value?: string | PopulatedReferral | null
  } | null
}
type Payload = Awaited<ReturnType<typeof getPayload>>

const FALLBACK_TEST_PRICES: Record<TestTypeValue, number> = {
  '11-panel-lab': 40,
  '11-panel-lab-no-etg': 40,
  '17-panel-instant': 35,
  '17-panel-sos-lab': 45,
  'etg-lab': 40,
}

const ACTIVE_GUIDED_TEST_TYPES = new Set<TestTypeValue>([
  '11-panel-lab',
  '11-panel-lab-no-etg',
  '17-panel-instant',
  '17-panel-sos-lab',
  'etg-lab',
])

function startOfToday() {
  const now = TZDate.tz(APP_TIMEZONE, new Date())
  return TZDate.tz(APP_TIMEZONE, now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
}

function startOfTomorrow() {
  const date = startOfToday()
  date.setDate(date.getDate() + 1)
  return date
}

function getRelationshipId(value: unknown): string | null {
  if (!value) return null
  if (typeof value === 'string') return value
  if (typeof value === 'object' && 'id' in value && typeof value.id === 'string') {
    return value.id
  }
  return null
}

async function resolveTestType(payload: Payload, value: string | TestType | null | undefined) {
  if (!value) return null
  if (typeof value === 'object') return value

  try {
    return await payload.findByID({
      collection: 'test-types',
      id: value,
      depth: 0,
      overrideAccess: true,
    })
  } catch {
    return null
  }
}

async function resolveReferral(payload: Payload, client: PopulatedClient | null) {
  const relationTo = client?.referral?.relationTo
  const value = client?.referral?.value

  if (!relationTo || !value) return null
  if (typeof value === 'object') return value

  try {
    return await payload.findByID({
      collection: relationTo,
      id: value,
      depth: 2,
      overrideAccess: true,
    })
  } catch {
    return null
  }
}

async function getPreferredTestType(payload: Payload, referral: PopulatedReferral | null | undefined) {
  const preferredTestType = referral?.preferredTestType
  const testType = await resolveTestType(payload, preferredTestType)
  return mapTestType(testType)
}

function mapTestType(testType: TestType | null | undefined) {
  if (!testType) return null

  const value = testType.value
  if (!value || !ACTIVE_GUIDED_TEST_TYPES.has(value as TestTypeValue)) return null
  const activeValue = value as TestTypeValue

  return {
    id: testType.id as string,
    label: testType.label,
    value: activeValue,
    category:
      testType.category === 'instant' || testType.category === 'lab'
        ? testType.category
        : activeValue.includes('instant')
          ? 'instant'
          : 'lab',
    price: typeof testType.price === 'number' ? testType.price : FALLBACK_TEST_PRICES[activeValue],
    toxAccessCode: typeof testType.toxAccessCode === 'string' ? testType.toxAccessCode : null,
  }
}

async function getBookingTestType(
  payload: Payload,
  bookingTestType: string | TestType | null | undefined,
  referral: PopulatedReferral | null | undefined,
) {
  const scheduledTestType = await resolveTestType(payload, bookingTestType)
  return mapTestType(scheduledTestType) ?? (await getPreferredTestType(payload, referral))
}

function splitName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return {
    firstName: parts[0] || '',
    lastName: parts.length > 1 ? parts.slice(1).join(' ') : '',
  }
}

function getPhoneFromCustomInputs(customInputs: unknown): string {
  if (!customInputs || typeof customInputs !== 'object') return ''
  const values = Object.values(customInputs as Record<string, unknown>)

  for (const value of values) {
    if (typeof value === 'string' && /\d{3}/.test(value) && value.replace(/\D/g, '').length >= 10) {
      return value
    }

    if (value && typeof value === 'object' && 'value' in value && typeof value.value === 'string') {
      const nestedValue = value.value
      if (/\d{3}/.test(nestedValue) && nestedValue.replace(/\D/g, '').length >= 10) {
        return nestedValue
      }
    }
  }

  return ''
}

async function getFirstDrugTestDate(payload: Payload, clientId: string | null | undefined) {
  if (!clientId) return null

  const result = await payload.find({
    collection: 'drug-tests',
    where: {
      relatedClient: {
        equals: clientId,
      },
    },
    depth: 0,
    limit: 1,
    sort: 'collectionDate',
    overrideAccess: true,
  })

  return result.docs[0]?.collectionDate || null
}

export async function getTodaysCollectionBookings() {
  const payload = await getPayload({ config })

  const result = await payload.find({
    collection: 'bookings',
    where: {
      and: [
        {
          startTime: {
            greater_than_equal: startOfToday().toISOString(),
          },
        },
        {
          startTime: {
            less_than: startOfTomorrow().toISOString(),
          },
        },
        {
          status: {
            in: ['confirmed', 'pending'],
          },
        },
      ],
    },
    depth: 4,
    limit: 100,
    sort: 'startTime',
    overrideAccess: true,
  })

  return Promise.all(
    result.docs.map(async (booking) => {
      const client = typeof booking.relatedClient === 'object' ? (booking.relatedClient as PopulatedClient) : null
      const referral = await resolveReferral(payload, client)
      const testType = await getBookingTestType(payload, booking.scheduledTestType, referral)
      const referralType = client?.referralType as 'court' | 'employer' | 'self' | undefined
      const firstDrugTestDate = await getFirstDrugTestDate(payload, client?.id as string | undefined)

      return {
        id: booking.id as string,
        title: booking.title as string,
        startTime: booking.startTime as string,
        endTime: booking.endTime as string,
        attendeeName: booking.attendeeName as string,
        attendeeEmail: booking.attendeeEmail as string,
        attendeePhone: getPhoneFromCustomInputs(booking.customInputs),
        calcomBookingId: booking.calcomBookingId as string | null | undefined,
        client: client
          ? {
              id: client.id as string,
              firstName: client.firstName as string,
              middleInitial: typeof client.middleInitial === 'string' ? client.middleInitial : null,
              lastName: client.lastName as string,
              email: client.email as string,
              dob: typeof client.dob === 'string' ? client.dob : null,
              gender: typeof client.gender === 'string' ? client.gender : null,
              phone: typeof client.phone === 'string' ? client.phone : null,
              firstDrugTestDate,
              referralType,
            }
          : null,
        referral: referral
          ? {
              id: referral.id as string,
              name: referral.name as string,
              type: client?.referral?.relationTo === 'courts' ? 'Court' : 'Employer',
            }
          : null,
        testType,
        payment: booking.payment || null,
        sampleCollection: booking.sampleCollection || null,
        needsRegistration: !client,
        needsTestType: Boolean(client && !testType),
      }
    }),
  )
}

export async function getActiveCollectionTestTypes() {
  const payload = await getPayload({ config })
  const result = await payload.find({
    collection: 'test-types',
    where: {
      isActive: {
        equals: true,
      },
    },
    depth: 0,
    limit: 20,
    sort: 'label',
    overrideAccess: true,
  })

  return result.docs
    .map((testType) => mapTestType(testType))
    .filter((testType): testType is NonNullable<ReturnType<typeof mapTestType>> => Boolean(testType))
}

export async function getBookingRegistrationDefaults(bookingId: string) {
  const payload = await getPayload({ config })
  const booking = await payload.findByID({
    collection: 'bookings',
    id: bookingId,
    depth: 1,
    overrideAccess: true,
  })

  const { firstName, lastName } = splitName(booking.attendeeName || '')

  return {
    firstName,
    lastName,
    email: booking.attendeeEmail || '',
    phone: getPhoneFromCustomInputs(booking.customInputs),
  }
}

export async function linkBookingToClient(bookingId: string, clientId: string) {
  const payload = await getPayload({ config })
  await payload.update({
    collection: 'bookings',
    id: bookingId,
    data: {
      relatedClient: clientId,
    },
    overrideAccess: true,
  })
  revalidateBookingViews()
}

export async function setBookingScheduledTestType(bookingId: string, testTypeId: string) {
  if (!bookingId || !testTypeId) {
    return { success: false, error: 'Booking and test type are required.' }
  }

  const payload = await getPayload({ config })
  await payload.update({
    collection: 'bookings',
    id: bookingId,
    data: {
      scheduledTestType: testTypeId,
    },
    overrideAccess: true,
  })
  revalidateBookingViews()

  return { success: true }
}

export async function recordBookingPayment(input: {
  bookingId: string
  amountDue: number
  amountPaid: number
  method: PaymentMethod
  status: PaymentStatus
  notes?: string
}) {
  if (!input.bookingId) {
    return { success: false, error: 'Booking is required.' }
  }

  if (!input.status || !input.method) {
    return { success: false, error: 'Payment method and status are required.' }
  }

  if (input.amountPaid < 0) {
    return { success: false, error: 'Amount paid cannot be negative.' }
  }

  if (input.status !== 'paid' && input.amountDue > 0 && input.amountPaid >= input.amountDue) {
    return { success: false, error: 'Use Paid if the full amount was collected.' }
  }

  const payload = await getPayload({ config })
  const booking = await payload.update({
    collection: 'bookings',
    id: input.bookingId,
    data: {
      payment: {
        amountDue: input.amountDue,
        amountPaid: input.amountPaid,
        method: input.method,
        status: input.status,
        notes: input.notes || null,
        collectedAt: new Date().toISOString(),
      },
    },
    depth: 0,
    overrideAccess: true,
  })
  revalidateBookingViews()

  return {
    success: true,
    payment: booking.payment,
  }
}

export async function refreshBookingClientContext(bookingId: string) {
  const payload = await getPayload({ config })
  const booking = await payload.findByID({
    collection: 'bookings',
    id: bookingId,
    depth: 4,
    overrideAccess: true,
  })

  const client = typeof booking.relatedClient === 'object' ? (booking.relatedClient as PopulatedClient) : null
  const referral = await resolveReferral(payload, client)
  const testType = await getBookingTestType(payload, booking.scheduledTestType, referral)

  return {
    clientId: getRelationshipId(booking.relatedClient),
    testType,
    needsRegistration: !client,
    needsTestType: Boolean(client && !testType),
  }
}
