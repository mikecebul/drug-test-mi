'use server'

import { getPayload } from 'payload'
import config from '@payload-config'
import type { Client, Court, Employer, TestType } from '@/payload-types'

type TestTypeValue =
  | '11-panel-lab'
  | '11-panel-lab-no-etg'
  | '15-panel-instant'
  | '17-panel-instant'
  | '17-panel-sos-lab'
  | 'etg-lab'

type PaymentStatus = 'paid' | 'partial' | 'unpaid'
type PaymentMethod = 'cash' | 'card' | 'not-paid'
type PopulatedReferral = Court | Employer
type PopulatedClient = Client & {
  referral?: {
    relationTo?: 'courts' | 'employers'
    value?: string | PopulatedReferral | null
  } | null
}

const FALLBACK_TEST_PRICES: Record<TestTypeValue, number> = {
  '11-panel-lab': 40,
  '11-panel-lab-no-etg': 40,
  '15-panel-instant': 35,
  '17-panel-instant': 35,
  '17-panel-sos-lab': 45,
  'etg-lab': 40,
}

function startOfToday() {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  return date
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

function getPreferredTestType(referral: PopulatedReferral | null | undefined) {
  const preferredTestType = referral?.preferredTestType
  if (!preferredTestType || typeof preferredTestType === 'string') return null

  const testType = preferredTestType as TestType
  const value = testType.value as TestTypeValue | undefined
  if (!value) return null

  return {
    id: testType.id as string,
    label: testType.label,
    value,
    category: testType.category === 'instant' || testType.category === 'lab'
      ? testType.category
      : value.includes('instant')
        ? 'instant'
        : 'lab',
    price: typeof testType.price === 'number' ? testType.price : FALLBACK_TEST_PRICES[value],
  }
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
            not_equals: 'cancelled',
          },
        },
      ],
    },
    depth: 4,
    limit: 100,
    sort: 'startTime',
    overrideAccess: true,
  })

  return result.docs.map((booking) => {
    const client = typeof booking.relatedClient === 'object' ? booking.relatedClient as PopulatedClient : null
    const referral = client?.referral?.value && typeof client.referral.value === 'object'
      ? client.referral.value
        : null
    const testType = getPreferredTestType(referral)
    const referralType = client?.referralType as 'court' | 'employer' | 'self' | undefined

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
            lastName: client.lastName as string,
            email: client.email as string,
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
      needsRegistration: !client || !referral || !referralType || !testType,
    }
  })
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

  const client = typeof booking.relatedClient === 'object' ? booking.relatedClient : null
  const referral = client?.referral?.value && typeof client.referral.value === 'object'
    ? client.referral.value
    : null
  const testType = getPreferredTestType(referral)

  return {
    clientId: getRelationshipId(booking.relatedClient),
    testType,
    needsRegistration: !client || !referral || !client?.referralType || !testType,
  }
}
