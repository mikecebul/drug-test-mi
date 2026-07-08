'use server'

import { getPayload } from 'payload'
import config from '@payload-config'
import type { Client, Court, Employer } from '@/payload-types'
import { getAppTimezoneDayWindow } from '@/lib/date-utils'
import { revalidateBookingViews } from '@/utilities/revalidateBookingViews'
import { getRecipients } from '@/collections/DrugTests/email/recipients'
import {
  getCalcomScheduledTestAnswerCandidates,
  type CalcomWebhookPayload,
} from '@/app/(payload)/api/webhooks/calcom/calcomWebhook'
import {
  findConfiguredTestTypeByCalcomAnswer,
  getActiveTestTypes,
  mapTestTypeValue,
  type GuidedTestType,
} from '@/config/test-types'
import { getCalcomBookingActionLinks } from './schedule-utils'

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

function getRelationshipId(value: unknown): string | null {
  if (!value) return null
  if (typeof value === 'string') return value
  if (typeof value === 'object' && 'id' in value && typeof value.id === 'string') {
    return value.id
  }
  return null
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

function getPreferredTestType(referral: PopulatedReferral | null | undefined) {
  return mapTestTypeValue(referral?.preferredTestType)
}

function getRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  return value as Record<string, unknown>
}

function getWebhookPayload(webhookData: unknown): Partial<CalcomWebhookPayload['payload']> {
  const webhookRecord = getRecord(webhookData)
  const payloadRecord = getRecord(webhookRecord?.payload)
  return payloadRecord ? (payloadRecord as Partial<CalcomWebhookPayload['payload']>) : {}
}

function getCalcomBookingTestType(booking: {
  customInputs?: unknown
  webhookData?: unknown
  title?: string | null
  type?: string | null
}) {
  const webhookPayload = getWebhookPayload(booking.webhookData)
  const candidates = getCalcomScheduledTestAnswerCandidates({
    ...webhookPayload,
    type: webhookPayload.type || booking.type || undefined,
    title: webhookPayload.title || booking.title || undefined,
    customInputs: webhookPayload.customInputs || getRecord(booking.customInputs),
    responses: webhookPayload.responses || getRecord(booking.customInputs),
  })

  for (const scheduledTestAnswer of candidates) {
    const testType = mapTestTypeValue(findConfiguredTestTypeByCalcomAnswer(scheduledTestAnswer))
    if (testType) return testType
  }

  return null
}

function getEffectiveBookingTestType(bookingTestType: unknown, referral: PopulatedReferral | null | undefined) {
  return mapTestTypeValue(bookingTestType) ?? getPreferredTestType(referral)
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

async function persistCalcomScheduledTestType(payload: Payload, bookingId: string, testType: GuidedTestType | null) {
  if (!testType?.value) return

  try {
    await payload.update({
      collection: 'bookings',
      id: bookingId,
      data: {
        scheduledTestType: testType.value,
      },
      overrideAccess: true,
    })
    revalidateBookingViews()
  } catch (error) {
    payload.logger.warn({
      msg: `Failed to save Cal.com scheduled test type on booking ${bookingId}`,
      err: error,
    })
  }
}

export async function getTodaysCollectionBookings() {
  const payload = await getPayload({ config })
  const todayWindow = getAppTimezoneDayWindow()

  const result = await payload.find({
    collection: 'bookings',
    where: {
      and: [
        {
          startTime: {
            greater_than_equal: todayWindow.start.toISOString(),
          },
        },
        {
          startTime: {
            less_than: todayWindow.end.toISOString(),
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
      const scheduledTestType = mapTestTypeValue(booking.scheduledTestType)
      const calcomTestType = getCalcomBookingTestType(booking)
      const bookingTestType = scheduledTestType ?? calcomTestType

      if (!scheduledTestType && calcomTestType) {
        await persistCalcomScheduledTestType(payload, booking.id as string, calcomTestType)
      }

      const referralTestType = getPreferredTestType(referral)
      const testType = bookingTestType ?? referralTestType
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
        calcomActionLinks: getCalcomBookingActionLinks({
          calcomBookingId: booking.calcomBookingId as string | null | undefined,
          webhookData: booking.webhookData,
        }),
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
          : referralType === 'self'
            ? {
                id: client?.id as string,
                name: 'Self',
                type: 'Self',
              }
            : null,
        referralTestType,
        bookingTestType,
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
  return getActiveTestTypes()
}

export async function getClientReferralProfile(clientId: string) {
  if (!clientId) return null

  const payload = await getPayload({ config })
  const client = await payload.findByID({
    collection: 'clients',
    id: clientId,
    depth: 0,
    overrideAccess: true,
  })

  if (!client) return null

  const recipients = await getRecipients(clientId, payload)
  const referralType =
    client.referralType === 'court' || client.referralType === 'employer' || client.referralType === 'self'
      ? client.referralType
      : 'self'

  return {
    referralType,
    referralTitle: recipients.referralTitle || (referralType === 'self' ? 'Self' : ''),
    referralEmails: recipients.referralEmails,
    referralPresetId: recipients.referralPresetId,
    hasExplicitReferralRecipients: recipients.hasExplicitReferralRecipients,
    referralRecipientsDetailed: recipients.referralRecipientsDetailed,
    clientAdditionalRecipientsDetailed: recipients.clientAdditionalRecipientsDetailed,
  }
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

  const mappedTestType = mapTestTypeValue(testTypeId)
  if (!mappedTestType) {
    return { success: false, error: 'Select a valid test type.' }
  }

  const payload = await getPayload({ config })
  const booking = await payload.findByID({
    collection: 'bookings',
    id: bookingId,
    depth: 0,
    overrideAccess: true,
  })
  const existingPayment = booking.payment
  const amountDue = mappedTestType?.price ?? existingPayment?.amountDue
  const amountPaid = existingPayment?.amountPaid ?? 0
  const paymentStatus: PaymentStatus = amountPaid >= (amountDue ?? 0) ? 'paid' : amountPaid > 0 ? 'partial' : 'unpaid'
  const payment =
    existingPayment && typeof amountDue === 'number'
      ? {
          ...existingPayment,
          amountDue,
          status: paymentStatus,
        }
      : existingPayment || undefined

  await payload.update({
    collection: 'bookings',
    id: bookingId,
    data: {
      scheduledTestType: mappedTestType.value,
      ...(payment ? { payment } : {}),
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
  const existingBooking = await payload.findByID({
    collection: 'bookings',
    id: input.bookingId,
    depth: 0,
    overrideAccess: true,
  })
  const existingPayment = existingBooking.payment
  const notes =
    typeof input.notes === 'string'
      ? input.notes.trim() || null
      : typeof existingPayment?.notes === 'string'
        ? existingPayment.notes
        : null

  const booking = await payload.update({
    collection: 'bookings',
    id: input.bookingId,
    data: {
      payment: {
        amountDue: input.amountDue,
        amountPaid: input.amountPaid,
        method: input.method,
        status: input.status,
        notes,
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
  const testType = getEffectiveBookingTestType(booking.scheduledTestType, referral)

  return {
    clientId: getRelationshipId(booking.relatedClient),
    testType,
    needsRegistration: !client,
    needsTestType: Boolean(client && !testType),
  }
}
