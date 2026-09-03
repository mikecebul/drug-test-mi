import Stripe from 'stripe'
import type { Payload, RequiredDataFromCollectionSlug } from 'payload'

import { getCalcomBookingGender } from '@/lib/client-gender'
import { formatPhoneForCal } from '@/lib/quick-book'
import { APP_TIMEZONE } from '@/lib/date-utils'
import { getTestTypeBookingLabel } from '@/config/test-types'
import type { Booking, Client } from '@/payload-types'
import { getValidatedRandomTestingCalcomEventType } from '@/lib/random-testing/calcom'
import { cancelCalcomBooking, createCalcomBooking, type CalcomBookingRecord } from '@/utilities/calcom-api'
import { getCalcomBookingActionLinks } from '@/utilities/calcom-booking-action-links'
import { getCalcomPaymentRecoveryStatus, isPastScheduledBookingTime } from './schedule-utils'

export type PendingPaymentRecoveryAction = 'accept' | 'cancel' | 'reschedule'

export type PendingPaymentRecoveryResult = {
  success: boolean
  bookingId?: string
  error?: string
  fallbackHref?: string | null
  refreshRequired?: boolean
  rescheduleHref?: string | null
  warning?: string
}

type RecoveryInput = {
  action: PendingPaymentRecoveryAction
  bookingId: string
  now?: Date
  payload: Payload
}

function getRelationshipId(value: unknown): string | null {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object' && 'id' in value && typeof value.id === 'string') return value.id
  return null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

function nestedString(value: unknown, path: string[]): string | null {
  let current = value
  for (const key of path) {
    current = asRecord(current)?.[key]
    if (current === undefined || current === null) return null
  }
  return typeof current === 'string' && current.trim() ? current.trim() : null
}

function getStripePaymentIntentId(booking: Booking) {
  const candidates = [
    typeof booking.calcomPaymentId === 'string' ? booking.calcomPaymentId : null,
    nestedString(booking.webhookData, ['payload', 'metadata', 'externalId']),
    nestedString(booking.webhookData, ['payload', 'payment', 'stripePaymentIntentId']),
  ]
  return candidates.find((candidate) => candidate?.startsWith('pi_')) || null
}

async function verifyPaymentStillPending(booking: Booking): Promise<PendingPaymentRecoveryResult | null> {
  const recoveryStatus = getCalcomPaymentRecoveryStatus(booking)

  if (recoveryStatus === 'partial') {
    return {
      success: false,
      error: 'This appointment has a partial payment and needs payment review before it can be changed.',
      refreshRequired: true,
    }
  }

  if (recoveryStatus !== 'pending') {
    return {
      success: false,
      error: 'This appointment is no longer awaiting payment. The schedule has been refreshed.',
      refreshRequired: true,
    }
  }

  const paymentIntentId = getStripePaymentIntentId(booking)
  if (!paymentIntentId) return null

  if (!process.env.STRIPE_SECRET_KEY) {
    return {
      success: false,
      error: 'Payment status could not be verified because Stripe is not configured. No booking was changed.',
    }
  }

  let paymentIntent: Stripe.PaymentIntent
  try {
    paymentIntent = await new Stripe(process.env.STRIPE_SECRET_KEY, {}).paymentIntents.retrieve(paymentIntentId)
  } catch {
    return {
      success: false,
      error: 'Payment status could not be verified with Stripe. No booking was changed.',
    }
  }

  const hasReceivedMoney = paymentIntent.amount_received > 0
  const canSafelyReplace = ['canceled', 'requires_action', 'requires_payment_method'].includes(paymentIntent.status)
  if (hasReceivedMoney || !canSafelyReplace) {
    return {
      success: false,
      error: 'The client payment changed while this action was open. No booking was changed.',
      refreshRequired: true,
    }
  }

  return null
}

async function loadPendingBooking(payload: Payload, bookingId: string) {
  const booking = (await payload.findByID({
    collection: 'bookings',
    id: bookingId,
    depth: 1,
    overrideAccess: true,
  })) as Booking

  if (booking.sampleCollection?.status === 'collected') {
    return {
      booking,
      issue: {
        success: false,
        error: 'This appointment already has a collected sample.',
        refreshRequired: true,
      } satisfies PendingPaymentRecoveryResult,
    }
  }

  if (booking.status === 'cancelled' || booking.status === 'rescheduled') {
    return {
      booking,
      issue: {
        success: false,
        error: 'This appointment is no longer active. The schedule has been refreshed.',
        refreshRequired: true,
      } satisfies PendingPaymentRecoveryResult,
    }
  }

  return { booking, issue: await verifyPaymentStillPending(booking) }
}

function getClientName(client: Client) {
  return [client.firstName, client.middleInitial, client.lastName].filter(Boolean).join(' ')
}

function buildBookingFields(booking: Booking, client: Client) {
  const test = getTestTypeBookingLabel(booking.scheduledTestType)
  const gender = getCalcomBookingGender(client.gender)

  return {
    ...(test ? { test } : {}),
    ...(gender ? { gender } : {}),
    title: getClientName(client),
  }
}

function buildReplacementData(input: {
  booking: Booking
  calcomBooking: CalcomBookingRecord
  client: Client
  eventTypeId: number
  eventTypeLength: number
}): RequiredDataFromCollectionSlug<'bookings'> {
  const host = input.calcomBooking.hosts?.[0]
  const amountDue = Math.max(0, input.booking.payment?.amountDue || 0)
  const previousCustomInputs = asRecord(input.booking.customInputs)

  return {
    title: input.calcomBooking.title || `Drug Test - ${getClientName(input.client)}`,
    type: `${input.eventTypeLength}min`,
    description: 'Unpaid appointment accepted by staff after an incomplete Cal.com payment.',
    additionalNotes: input.booking.additionalNotes || null,
    startTime: input.calcomBooking.start || input.booking.startTime,
    endTime:
      input.calcomBooking.end ||
      new Date(new Date(input.booking.startTime).getTime() + input.eventTypeLength * 60_000).toISOString(),
    status: 'confirmed',
    organizer: {
      ...(typeof host?.id === 'number' ? { id: host.id } : {}),
      name: host?.name || input.booking.organizer?.name || 'MI Drug Test',
      email: host?.email || input.booking.organizer?.email || 'booking@midrugtest.com',
      timeZone: host?.timeZone || input.booking.organizer?.timeZone || APP_TIMEZONE,
    },
    attendeeName: getClientName(input.client),
    attendeeEmail: input.client.email,
    relatedClient: input.client.id,
    ...(input.booking.scheduledTestType ? { scheduledTestType: input.booking.scheduledTestType } : {}),
    location: input.calcomBooking.location || input.booking.location || 'MI Drug Test',
    calcomBookingId: input.calcomBooking.uid,
    calcomBookingNumericId: input.calcomBooking.id,
    calcomRescheduledFromId: input.booking.calcomBookingId,
    eventTypeId: input.calcomBooking.eventTypeId || input.eventTypeId,
    payment: {
      amountDue,
      amountPaid: 0,
      method: 'not-paid',
      status: 'unpaid',
      notes: 'Payment will be collected during the appointment.',
    },
    customInputs: {
      ...previousCustomInputs,
      source: 'pending-payment-recovery',
      replacedPendingBookingId: String(input.booking.id),
      replacedPendingCalcomBookingUid: input.booking.calcomBookingId,
    },
    webhookData: {
      source: 'pending-payment-recovery',
      calcomBooking: input.calcomBooking,
      replacedPendingBookingId: String(input.booking.id),
    },
    createdViaWebhook: false,
  }
}

function isDuplicateKeyError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const record = error as { cause?: unknown; code?: unknown; message?: unknown }
  return (
    record.code === 11000 ||
    (typeof record.message === 'string' && /duplicate\s+key/i.test(record.message)) ||
    isDuplicateKeyError(record.cause)
  )
}

async function findReplacement(payload: Payload, bookingUid: string) {
  const result = await payload.find({
    collection: 'bookings',
    where: { calcomBookingId: { equals: bookingUid } },
    depth: 0,
    limit: 1,
    overrideAccess: true,
  })
  return result.docs[0] || null
}

async function findActiveRecoveryReplacement(payload: Payload, originalBookingUid: string) {
  const result = await payload.find({
    collection: 'bookings',
    where: {
      and: [{ calcomRescheduledFromId: { equals: originalBookingUid } }, { status: { in: ['confirmed', 'pending'] } }],
    },
    sort: '-createdAt',
    depth: 0,
    limit: 1,
    overrideAccess: true,
  })
  return (result.docs[0] as Booking | undefined) || null
}

function toCalcomBookingRecord(booking: Booking): CalcomBookingRecord | null {
  if (!booking.calcomBookingId) return null

  return {
    id: booking.calcomBookingNumericId || 0,
    uid: booking.calcomBookingId,
    title: booking.title,
    start: booking.startTime,
    end: booking.endTime,
    location: booking.location,
    eventTypeId: booking.eventTypeId || undefined,
    status: booking.status,
  }
}

async function ensureReplacementBooking(
  payload: Payload,
  data: RequiredDataFromCollectionSlug<'bookings'>,
): Promise<Booking> {
  const bookingUid = data.calcomBookingId
  if (!bookingUid) throw new Error('The replacement booking is missing its Cal.com UID.')

  const existing = await findReplacement(payload, bookingUid)
  if (existing) {
    return (await payload.update({
      collection: 'bookings',
      id: existing.id,
      data,
      depth: 0,
      overrideAccess: true,
    })) as Booking
  }

  try {
    return (await payload.create({
      collection: 'bookings',
      data,
      depth: 0,
      overrideAccess: true,
    })) as Booking
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error
    const racedBooking = await findReplacement(payload, bookingUid)
    if (!racedBooking) throw error
    return (await payload.update({
      collection: 'bookings',
      id: racedBooking.id,
      data,
      depth: 0,
      overrideAccess: true,
    })) as Booking
  }
}

function isPastCancellationError(error?: string) {
  const normalized = error?.toLowerCase() || ''
  return (
    normalized.includes('cancel') &&
    (normalized.includes('past') || normalized.includes('passed')) &&
    (normalized.includes('scheduled') || normalized.includes('start') || normalized.includes('time'))
  )
}

async function cancelBookingInCalcom(booking: Booking, reason: string, now: Date) {
  if (!booking.calcomBookingId || isPastScheduledBookingTime(booking.startTime, now.getTime())) {
    return { success: true, skippedPastBooking: Boolean(booking.calcomBookingId) }
  }

  const result = await cancelCalcomBooking({ bookingUid: booking.calcomBookingId, cancellationReason: reason })
  if (result.success) return { success: true, skippedPastBooking: false }
  if (isPastCancellationError(result.error)) return { success: true, skippedPastBooking: true }
  return { success: false, error: result.error || 'Cal.com cancellation failed.', skippedPastBooking: false }
}

async function markLocalBookingCancelled(payload: Payload, bookingId: string) {
  await payload.update({
    collection: 'bookings',
    id: bookingId,
    data: { status: 'cancelled' },
    depth: 0,
    overrideAccess: true,
  })
}

async function rollbackReplacement(payload: Payload, replacement: CalcomBookingRecord) {
  const rollback = await cancelCalcomBooking({
    bookingUid: replacement.uid,
    cancellationReason: 'Rolled back because the original pending-payment booking could not be cancelled',
  })
  const localReplacement = await findReplacement(payload, replacement.uid)
  if (rollback.success && localReplacement) {
    await markLocalBookingCancelled(payload, String(localReplacement.id))
  }
  return rollback
}

export async function recoverPendingPaymentBooking(input: RecoveryInput): Promise<PendingPaymentRecoveryResult> {
  const now = input.now || new Date()
  const initial = await loadPendingBooking(input.payload, input.bookingId)
  if (initial.issue) return initial.issue

  const originalBooking = initial.booking
  const originalCalcomUid = originalBooking.calcomBookingId
  if (!originalCalcomUid) {
    return { success: false, error: 'This pending appointment is not linked to a Cal.com booking.' }
  }

  if (input.action === 'cancel') {
    const latest = await loadPendingBooking(input.payload, input.bookingId)
    if (latest.issue) return latest.issue
    const cancellation = await cancelBookingInCalcom(latest.booking, 'Pending payment cancelled by staff', now)
    if (!cancellation.success) {
      return {
        success: false,
        error: cancellation.error,
        fallbackHref: getCalcomBookingActionLinks({ calcomBookingId: originalCalcomUid }).cancelHref,
      }
    }

    await markLocalBookingCancelled(input.payload, input.bookingId)
    return {
      success: true,
      ...(cancellation.skippedPastBooking
        ? { warning: "The past appointment was removed from today's schedule locally." }
        : {}),
    }
  }

  const clientId = getRelationshipId(originalBooking.relatedClient)
  if (!clientId) {
    return {
      success: false,
      error: 'Link this appointment to the registered client before accepting or rescheduling it.',
    }
  }
  if (input.action === 'accept' && isPastScheduledBookingTime(originalBooking.startTime, now.getTime())) {
    return { success: false, error: 'A past pending-payment appointment cannot be accepted at its original time.' }
  }

  const client = (await input.payload.findByID({
    collection: 'clients',
    id: clientId,
    depth: 0,
    overrideAccess: true,
  })) as Client
  const clientPhone = formatPhoneForCal(client.phone)
  let replacementBooking = await findActiveRecoveryReplacement(input.payload, originalCalcomUid)
  let replacement = replacementBooking ? toCalcomBookingRecord(replacementBooking) : null

  if (!replacement || !replacementBooking) {
    const eventType = await getValidatedRandomTestingCalcomEventType()
    replacement = await createCalcomBooking({
      attendee: {
        name: getClientName(client),
        email: client.email,
        ...(clientPhone ? { phoneNumber: clientPhone } : {}),
        language: 'en',
        timeZone: APP_TIMEZONE,
      },
      bookingFieldsResponses: buildBookingFields(originalBooking, client),
      eventTypeId: eventType.id,
      metadata: {
        source: 'pending-payment-recovery',
        action: input.action,
        replacedPendingBookingId: String(originalBooking.id),
        replacedPendingCalcomBookingUid: originalCalcomUid,
        paymentStatus: 'unpaid',
      },
      start: originalBooking.startTime,
    })

    try {
      replacementBooking = await ensureReplacementBooking(
        input.payload,
        buildReplacementData({
          booking: originalBooking,
          calcomBooking: replacement,
          client,
          eventTypeId: eventType.id,
          eventTypeLength: eventType.lengthInMinutes || 10,
        }),
      )
    } catch {
      const rollback = await rollbackReplacement(input.payload, replacement)
      return {
        success: false,
        error: rollback.success
          ? 'The unpaid replacement could not be saved, so it was cancelled. The original booking was not changed.'
          : 'The unpaid replacement could not be saved or rolled back. The original booking was not changed, and the replacement needs manual cancellation in Cal.com.',
        fallbackHref: rollback.success
          ? null
          : getCalcomBookingActionLinks({ calcomBookingId: replacement.uid }).cancelHref,
      }
    }
  }

  const latest = await loadPendingBooking(input.payload, input.bookingId)
  if (latest.issue) {
    const rollback = await rollbackReplacement(input.payload, replacement)
    return {
      ...latest.issue,
      error: rollback.success
        ? latest.issue.error
        : `${latest.issue.error} The replacement booking also needs manual cancellation in Cal.com.`,
      fallbackHref: rollback.success
        ? latest.issue.fallbackHref
        : getCalcomBookingActionLinks({ calcomBookingId: replacement.uid }).cancelHref,
    }
  }

  const cancellation = await cancelBookingInCalcom(
    latest.booking,
    input.action === 'accept'
      ? 'Replaced with an unpaid booking accepted by staff'
      : 'Replaced with an unpaid booking for staff rescheduling',
    now,
  )
  if (!cancellation.success) {
    const rollback = await rollbackReplacement(input.payload, replacement)
    return {
      success: false,
      error: rollback.success
        ? `The original booking could not be cancelled, so the unpaid replacement was rolled back. ${cancellation.error}`
        : `The original booking could not be cancelled and the replacement rollback also failed. ${cancellation.error}`,
      fallbackHref: getCalcomBookingActionLinks({
        calcomBookingId: rollback.success ? originalCalcomUid : replacement.uid,
      }).cancelHref,
    }
  }

  await markLocalBookingCancelled(input.payload, input.bookingId)
  const rescheduleHref =
    input.action === 'reschedule'
      ? getCalcomBookingActionLinks({ calcomBookingId: replacement.uid }).rescheduleHref
      : null

  return {
    success: true,
    bookingId: String(replacementBooking.id),
    rescheduleHref,
    ...(cancellation.skippedPastBooking
      ? { warning: 'The past payment hold was removed locally and replaced with an unpaid appointment.' }
      : {}),
  }
}
