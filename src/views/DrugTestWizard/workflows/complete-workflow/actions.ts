'use server'

import { getPayload, type PayloadRequest, type RequiredDataFromCollectionSlug } from 'payload'
import config from '@payload-config'
import Stripe from 'stripe'
import type { Booking as PayloadBooking, Client, Court, Employer, Payment } from '@/payload-types'
import { APP_TIMEZONE, getAppTimezoneDayWindow } from '@/lib/date-utils'
import { revalidateBookingViews } from '@/utilities/revalidateBookingViews'
import { getRecipients } from '@/collections/DrugTests/email/recipients'
import { headers } from 'next/headers'
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
import { getCalcomBookingActionLinks, isPastScheduledBookingTime } from './schedule-utils'
import { applyIncomingPayment, normalizeMoney } from '@/collections/Payments/services/applyPayment'
import { withPayloadTransaction } from '@/collections/Payments/services/withPayloadTransaction'
import {
  findRefundableCalcomBookingPayment,
  syncCalcomPrepaidBookingPayment,
} from '@/collections/Payments/services/calcomBookingPayment'
import { cancelCalcomBooking } from '@/utilities/calcom-api'

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
type AdminPayloadRequest = Pick<PayloadRequest, 'payload' | 'user'>
type ScheduleActionResult = {
  success: boolean
  error?: string
  warning?: string
  fallbackHref?: string | null
  refundedAmount?: number
}

function getRelationshipId(value: unknown): string | null {
  if (!value) return null
  if (typeof value === 'string') return value
  if (typeof value === 'object' && 'id' in value && typeof value.id === 'string') {
    return value.id
  }
  return null
}

function getCancelHref(booking: Pick<PayloadBooking, 'calcomBookingId' | 'webhookData'>) {
  return getCalcomBookingActionLinks({
    calcomBookingId: booking.calcomBookingId as string | null | undefined,
    webhookData: booking.webhookData,
  }).cancelHref
}

function isPastScheduledCalcomCancelError(error?: string) {
  if (!error) return false
  const normalized = error.toLowerCase()
  return (
    normalized.includes('cancel') &&
    (normalized.includes('past') || normalized.includes('passed')) &&
    (normalized.includes('scheduled') || normalized.includes('start') || normalized.includes('time'))
  )
}

async function cancelCalcomBookingIfNeeded(booking: PayloadBooking): Promise<ScheduleActionResult> {
  if (!booking.calcomBookingId) {
    return { success: true }
  }

  if (isPastScheduledBookingTime(booking.startTime)) {
    return {
      success: true,
      warning: "This booking is past its scheduled time, so it was removed from today's schedule locally.",
    }
  }

  const result = await cancelCalcomBooking({
    bookingUid: booking.calcomBookingId,
    cancellationReason: 'Cancelled by admin',
  })

  if (result.success) {
    return { success: true }
  }

  if (isPastScheduledCalcomCancelError(result.error)) {
    return {
      success: true,
      warning:
        "Cal.com says this booking is past its scheduled time, so it was removed from today's schedule locally.",
    }
  }

  return {
    success: false,
    error: result.error || 'Cal.com cancellation failed.',
    fallbackHref: getCancelHref(booking),
  }
}

function getBookingPaymentAfterRefund(booking: PayloadBooking) {
  const existingPayment = booking.payment || {}
  return {
    ...existingPayment,
    amountPaid: 0,
    method: 'not-paid' as const,
    status: 'unpaid' as const,
    collectedAt: null,
  }
}

async function getRefundPaymentIntent(input: { stripe: Stripe; payment: Payment; booking: PayloadBooking }) {
  if (input.payment.stripePaymentIntentId) {
    return input.payment.stripePaymentIntentId
  }

  if (typeof input.booking.calcomPaymentId === 'string' && input.booking.calcomPaymentId.startsWith('pi_')) {
    return input.booking.calcomPaymentId
  }

  if (!input.payment.stripeCheckoutSessionId) return null

  const session = await input.stripe.checkout.sessions.retrieve(input.payment.stripeCheckoutSessionId)
  const paymentIntent = session.payment_intent
  return typeof paymentIntent === 'string' ? paymentIntent : paymentIntent?.id || null
}

async function getAdminPayload(req?: AdminPayloadRequest) {
  if (req) {
    if (!req.user || req.user.collection !== 'admins') {
      throw new Error('Unauthorized - admin access required.')
    }

    return req.payload as Payload
  }

  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await headers() })

  if (!user || user.collection !== 'admins') {
    throw new Error('Unauthorized - admin access required.')
  }

  return payload
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

export async function getTodaysCollectionBookings(req?: AdminPayloadRequest) {
  const payload = await getAdminPayload(req)
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

  const bookingIds = result.docs.map((booking) => String(booking.id))
  const guidedPaymentTotals = new Map<string, number>()

  if (bookingIds.length > 0) {
    const guidedPayments = await payload.find({
      collection: 'payments',
      where: {
        and: [
          {
            relatedBooking: {
              in: bookingIds,
            },
          },
          {
            source: {
              equals: 'guided-workflow',
            },
          },
          {
            status: {
              equals: 'posted',
            },
          },
        ],
      },
      depth: 0,
      limit: 1000,
      overrideAccess: true,
    })

    for (const payment of guidedPayments.docs) {
      const relatedBookingId = getRelationshipId(payment.relatedBooking)
      if (!relatedBookingId) continue
      guidedPaymentTotals.set(
        relatedBookingId,
        normalizeMoney((guidedPaymentTotals.get(relatedBookingId) || 0) + normalizeMoney(payment.amount)),
      )
    }
  }

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
              moneyOwed: typeof client.moneyOwed === 'number' ? client.moneyOwed : 0,
              creditBalance: typeof client.creditBalance === 'number' ? client.creditBalance : 0,
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
        guidedPaymentTotal: guidedPaymentTotals.get(String(booking.id)) || 0,
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

export async function getClientOutstandingPaymentBalances(clientId: string) {
  if (!clientId) return []

  const payload = await getAdminPayload()
  const result = await payload.find({
    collection: 'drug-tests',
    where: {
      and: [
        {
          relatedClient: {
            equals: clientId,
          },
        },
        {
          'payment.balanceDue': {
            greater_than: 0,
          },
        },
      ],
    },
    depth: 0,
    limit: 1000,
    sort: 'collectionDate',
    overrideAccess: true,
  })

  return result.docs
    .map((test) => {
      const testType = mapTestTypeValue(test.testType)
      return {
        id: String(test.id),
        collectionDate: test.collectionDate || test.createdAt,
        testTypeLabel: testType?.label || 'Drug test',
        balanceDue: normalizeMoney(test.payment?.balanceDue),
      }
    })
    .filter((balance) => balance.balanceDue > 0)
}

export async function getClientReferralProfile(clientId: string) {
  if (!clientId) return null

  const payload = await getAdminPayload()
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
  const payload = await getAdminPayload()
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
  const payload = await getAdminPayload()
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

  const payload = await getAdminPayload()
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

export async function createWalkInBooking(input: { clientId: string; testTypeId: string }) {
  if (!input.clientId || !input.testTypeId) {
    return { success: false, error: 'Client and test type are required.' }
  }

  const mappedTestType = getActiveTestTypes().find((testType) => testType.value === input.testTypeId)
  if (!mappedTestType) {
    return { success: false, error: 'Select an active collection test type.' }
  }

  const payload = await getAdminPayload()
  const client = await payload.findByID({
    collection: 'clients',
    id: input.clientId,
    depth: 0,
    overrideAccess: true,
  })
  const startTime = new Date()
  const endTime = new Date(startTime.getTime() + 30 * 60 * 1000)
  const attendeeName = [client.firstName, client.middleInitial, client.lastName].filter(Boolean).join(' ')

  const bookingData: RequiredDataFromCollectionSlug<'bookings'> = {
    title: 'Walk-in Drug Test',
    type: 'walk-in',
    description: 'Internal walk-in collection created from the guided workflow.',
    additionalNotes: 'Created without a Cal.com booking.',
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
    status: 'confirmed',
    organizer: {
      name: 'MI Drug Test',
      email: 'admin@midrugtest.com',
      timeZone: APP_TIMEZONE,
    },
    attendeeName,
    attendeeEmail: client.email,
    relatedClient: input.clientId,
    scheduledTestType: mappedTestType.value,
    location: 'Walk-in',
    customInputs: {
      source: 'guided-walk-in',
    },
    createdViaWebhook: false,
  }

  const booking = await payload.create({
    collection: 'bookings',
    data: bookingData,
    overrideAccess: true,
  })

  revalidateBookingViews()

  return {
    success: true,
    bookingId: booking.id as string,
  }
}

export async function cancelGuidedBooking(input: { bookingId: string }): Promise<ScheduleActionResult> {
  if (!input.bookingId) {
    return { success: false, error: 'Booking is required.' }
  }

  const payload = await getAdminPayload()
  const booking = (await payload.findByID({
    collection: 'bookings',
    id: input.bookingId,
    depth: 0,
    overrideAccess: true,
  })) as PayloadBooking

  if (booking.sampleCollection?.status === 'collected') {
    return { success: false, error: 'This appointment already has a collected sample.' }
  }

  if (booking.status === 'cancelled') {
    return { success: true }
  }

  const cancelResult = await cancelCalcomBookingIfNeeded(booking)
  if (!cancelResult.success) {
    return cancelResult
  }

  await payload.update({
    collection: 'bookings',
    id: input.bookingId,
    data: {
      status: 'cancelled',
    },
    overrideAccess: true,
  })

  revalidateBookingViews()
  return { success: true, warning: cancelResult.warning }
}

export async function cancelAndRefundGuidedBooking(input: { bookingId: string }): Promise<ScheduleActionResult> {
  if (!input.bookingId) {
    return { success: false, error: 'Booking is required.' }
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return { success: false, error: 'Stripe secret key is not configured.' }
  }

  const payload = await getAdminPayload()
  const booking = (await payload.findByID({
    collection: 'bookings',
    id: input.bookingId,
    depth: 0,
    overrideAccess: true,
  })) as PayloadBooking

  if (booking.sampleCollection?.status === 'collected') {
    return { success: false, error: 'This appointment already has a collected sample.' }
  }

  const syncedPayment = await syncCalcomPrepaidBookingPayment({
    payload,
    booking,
  })
  const refundablePayment =
    syncedPayment?.status === 'posted'
      ? (syncedPayment as Payment)
      : await findRefundableCalcomBookingPayment({
          payload,
          bookingId: input.bookingId,
        })

  if (!refundablePayment) {
    return { success: false, error: 'No posted Stripe prepayment was found for this booking.' }
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {})
  let paymentIntentId: string | null = null

  try {
    paymentIntentId = await getRefundPaymentIntent({
      stripe,
      payment: refundablePayment,
      booking,
    })
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? `Unable to load Stripe payment: ${error.message}` : 'Unable to load Stripe payment.',
    }
  }

  if (!paymentIntentId) {
    return { success: false, error: 'No Stripe payment intent was found for this booking payment.' }
  }

  const refundedAmount = normalizeMoney(refundablePayment.amount)
  let refund: Stripe.Refund

  try {
    refund = await stripe.refunds.create(
      {
        payment_intent: paymentIntentId,
        amount: Math.round(refundedAmount * 100),
      },
      {
        idempotencyKey: `calcom-booking-refund-${input.bookingId}-${refundablePayment.id}`,
      },
    )
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? `Stripe refund failed: ${error.message}` : 'Stripe refund failed.',
    }
  }

  await payload.update({
    collection: 'payments',
    id: refundablePayment.id,
    data: {
      status: 'refunded',
      refundedAt: new Date().toISOString(),
      refundedAmount,
      stripeRefundId: refund.id,
    },
    overrideAccess: true,
  })

  const cancelResult = await cancelCalcomBookingIfNeeded(booking)
  await payload.update({
    collection: 'bookings',
    id: input.bookingId,
    data: {
      ...(cancelResult.success ? { status: 'cancelled' as const } : {}),
      payment: getBookingPaymentAfterRefund(booking),
    },
    overrideAccess: true,
  })

  revalidateBookingViews()

  if (cancelResult.success && cancelResult.warning) {
    return {
      success: true,
      warning: `Refund issued. ${cancelResult.warning}`,
      refundedAmount,
    }
  }

  if (!cancelResult.success) {
    return {
      success: true,
      warning: `Refund issued, but Cal.com cancellation still needs attention: ${cancelResult.error}`,
      fallbackHref: cancelResult.fallbackHref,
      refundedAmount,
    }
  }

  return {
    success: true,
    refundedAmount,
  }
}

export async function recordBookingPayment(input: {
  bookingId: string
  amountReceived: number
  method: Extract<PaymentMethod, 'cash' | 'card'>
  notes?: string
}) {
  if (!input.bookingId) {
    return { success: false, error: 'Booking is required.' }
  }

  if (input.method !== 'cash' && input.method !== 'card') {
    return { success: false, error: 'Payment method must be cash or card.' }
  }

  if (!Number.isFinite(input.amountReceived) || input.amountReceived < 0) {
    return { success: false, error: 'Amount received must be zero or greater.' }
  }

  const payload = await getAdminPayload()
  const payment = await withPayloadTransaction(payload, async (req) => {
    const existingBooking = await payload.findByID({
      collection: 'bookings',
      id: input.bookingId,
      depth: 4,
      overrideAccess: true,
      req,
    })
    const clientId = getRelationshipId(existingBooking.relatedClient)
    if (!clientId) {
      throw new Error('Select or register the client before recording payment.')
    }

    const client =
      typeof existingBooking.relatedClient === 'object'
        ? (existingBooking.relatedClient as PopulatedClient)
        : null
    const referral = await resolveReferral(payload, client)
    const testType =
      mapTestTypeValue(existingBooking.scheduledTestType) ??
      getCalcomBookingTestType(existingBooking) ??
      getPreferredTestType(referral)
    const amountDue = normalizeMoney(testType?.price ?? existingBooking.payment?.amountDue)

    if (amountDue <= 0) {
      throw new Error("Today's test does not have a valid payment amount.")
    }

    const existingPayment = existingBooking.payment
    const existingAmountPaid = Math.min(normalizeMoney(existingPayment?.amountPaid), amountDue)
    const currentBookingBalance = Math.max(0, normalizeMoney(amountDue - existingAmountPaid))
    const notes =
      typeof input.notes === 'string'
        ? input.notes.trim() || null
        : typeof existingPayment?.notes === 'string'
          ? existingPayment.notes
          : null

    let amountAppliedToBooking = 0

    if (input.amountReceived > 0) {
      const ledgerPayment = await applyIncomingPayment({
        payload,
        clientId,
        amount: input.amountReceived,
        method: input.method,
        source: 'guided-workflow',
        relatedBooking: input.bookingId,
        bookingBalanceDue: currentBookingBalance,
        allocationOrder: 'oldest-balance-first',
        req,
      })

      amountAppliedToBooking = normalizeMoney(ledgerPayment.reservedForBookingAmount)
    }

    const nextAmountPaid = Math.min(amountDue, normalizeMoney(existingAmountPaid + amountAppliedToBooking))
    const nextBalanceDue = Math.max(0, normalizeMoney(amountDue - nextAmountPaid))
    const bookingPaymentStatus: PaymentStatus =
      nextBalanceDue <= 0 ? 'paid' : nextAmountPaid > 0 ? 'partial' : 'unpaid'
    const bookingPaymentMethod: PaymentMethod =
      amountAppliedToBooking > 0
        ? input.method
        : existingAmountPaid > 0 && existingPayment?.method
          ? existingPayment.method
          : 'not-paid'

    const booking = await payload.update({
      collection: 'bookings',
      id: input.bookingId,
      data: {
        payment: {
          amountDue,
          amountPaid: nextAmountPaid,
          method: bookingPaymentMethod,
          status: bookingPaymentStatus,
          notes,
          collectedAt: new Date().toISOString(),
        },
      },
      depth: 0,
      overrideAccess: true,
      req,
    })

    return booking.payment
  })

  revalidateBookingViews()

  return {
    success: true,
    payment,
  }
}

export async function refreshBookingClientContext(bookingId: string) {
  const payload = await getAdminPayload()
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
