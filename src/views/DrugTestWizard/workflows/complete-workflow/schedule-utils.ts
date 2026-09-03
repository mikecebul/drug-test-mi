import { getClientGenderBadgeClass, normalizeClientGender } from '@/lib/client-gender'

export type GuidedScheduleStep = 'review'
export type GuidedPaymentChoice = 'paid' | 'pre-paid' | 'still-owes'
export { getCalcomBookingActionLinks } from '@/utilities/calcom-booking-action-links'

export type GuidedClientIdentity = {
  firstName?: string | null
  middleInitial?: string | null
  lastName?: string | null
}

function normalizeName(value: string | null | undefined) {
  return (value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('en-US')
    .replace(/[^a-z0-9]/g, '')
}

export function getGuidedClientName(client: GuidedClientIdentity | null | undefined) {
  if (!client) return ''
  return [client.firstName, client.middleInitial, client.lastName].filter(Boolean).join(' ').trim()
}

export function doesGuidedBookingNameMatchClient(
  attendeeName: string | null | undefined,
  client: GuidedClientIdentity | null | undefined,
) {
  const clientFirstName = normalizeName(client?.firstName)
  const clientLastName = normalizeName(client?.lastName)
  if (!clientFirstName || !clientLastName || !attendeeName?.trim()) return false

  const commaParts = attendeeName.split(',')
  if (commaParts.length === 2) {
    const bookingLastName = normalizeName(commaParts[0])
    const bookingFirstName = normalizeName(commaParts[1]?.trim().split(/\s+/)[0])
    return bookingFirstName === clientFirstName && bookingLastName === clientLastName
  }

  const bookingNameParts = attendeeName.trim().split(/\s+/).filter(Boolean)
  const bookingFirstName = normalizeName(bookingNameParts[0])
  const bookingRemainingName = normalizeName(bookingNameParts.slice(1).join(' '))

  return bookingFirstName === clientFirstName && bookingRemainingName.endsWith(clientLastName)
}

export function isPastScheduledBookingTime(startTime: string | null | undefined, now = Date.now()) {
  if (!startTime) return false

  const scheduledTime = new Date(startTime).getTime()
  return Number.isFinite(scheduledTime) && scheduledTime <= now
}
export type { CalcomBookingActionLinks } from '@/utilities/calcom-booking-action-links'

export type GuidedScheduleBooking = {
  id: string
  needsRegistration: boolean
  needsTestType: boolean
  status?: string | null
  createdViaWebhook?: boolean | null
  calcomBookingId?: string | null
  calcomPaymentId?: string | null
  webhookData?: unknown
  sampleCollection?: {
    status?: string | null
  } | null
  payment?: {
    status?: string | null
    method?: string | null
    amountDue?: number | null
    amountPaid?: number | null
  } | null
}

export type CalcomPaymentRecoveryStatus = 'pending' | 'partial' | null

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

function getWebhookTrigger(webhookData: unknown) {
  const trigger = asRecord(webhookData)?.triggerEvent
  return typeof trigger === 'string' ? trigger : null
}

/**
 * Distinguishes an abandoned Cal.com checkout from an intentional unpaid
 * appointment. The positive amount and Cal.com/card origin are both required,
 * so staff-created and random-testing appointments remain normal schedule rows.
 */
export function getCalcomPaymentRecoveryStatus(
  booking: Pick<
    GuidedScheduleBooking,
    'calcomBookingId' | 'calcomPaymentId' | 'createdViaWebhook' | 'payment' | 'status' | 'webhookData'
  >,
): CalcomPaymentRecoveryStatus {
  const amountDue = typeof booking.payment?.amountDue === 'number' ? booking.payment.amountDue : 0
  const amountPaid = typeof booking.payment?.amountPaid === 'number' ? booking.payment.amountPaid : 0
  if (amountDue <= 0 || amountPaid >= amountDue || booking.payment?.status === 'paid') return null

  const trigger = getWebhookTrigger(booking.webhookData)
  const isCalcomCardAttempt = Boolean(
    booking.calcomBookingId &&
    booking.payment?.method === 'card' &&
    (booking.createdViaWebhook ||
      booking.calcomPaymentId ||
      booking.status === 'pending' ||
      trigger === 'BOOKING_PAYMENT_INITIATED'),
  )
  if (!isCalcomCardAttempt) return null

  if (amountPaid > 0 || booking.payment?.status === 'partial') return 'partial'
  if (booking.payment?.status === 'unpaid') return 'pending'
  return null
}

export function formatGuidedGender(value?: string | null) {
  const gender = normalizeClientGender(value)
  if (gender === 'male') return 'Male'
  if (gender === 'female') return 'Female'
  if (gender === 'prefer-not-to-say') return 'Prefer not to say'
  return 'Unknown'
}

export function getGuidedGenderBadgeClass(value?: string | null) {
  return getClientGenderBadgeClass(value)
}

export function getGuidedPaymentChoice(
  payment: GuidedScheduleBooking['payment'] | undefined,
): GuidedPaymentChoice | null {
  if (!payment?.status) return null
  const amountDue = typeof payment.amountDue === 'number' ? payment.amountDue : 0
  const amountPaid = typeof payment.amountPaid === 'number' ? payment.amountPaid : 0

  if (payment.method === 'pre-paid' && (payment.status === 'paid' || amountDue === 0 || amountPaid >= amountDue)) {
    return 'pre-paid'
  }
  if (amountDue > 0 && amountPaid >= amountDue) return 'paid'
  if (payment.status === 'partial') return 'still-owes'
  if (payment.status === 'unpaid') return 'still-owes'
  if (payment.status === 'paid') return 'paid'
  return null
}

export function getGuidedPaymentLabel(booking: GuidedScheduleBooking) {
  if (booking.sampleCollection?.status === 'collected') return 'Collected'
  const recoveryStatus = getCalcomPaymentRecoveryStatus(booking)
  if (recoveryStatus === 'pending') return 'Payment pending'
  if (recoveryStatus === 'partial') return 'Payment review'
  const choice = getGuidedPaymentChoice(booking.payment)
  if (choice === 'pre-paid') return 'Pre-paid'
  if (choice === 'still-owes') return 'Still owes'
  if (choice === 'paid') return 'Paid'
  return 'Unpaid'
}

export function getGuidedBookingNextStep(_booking: GuidedScheduleBooking): GuidedScheduleStep {
  return 'review'
}

export function getGuidedScheduleHref(booking: GuidedScheduleBooking) {
  const params = new URLSearchParams({
    workflow: 'guided',
    step: getGuidedBookingNextStep(booking),
    bookingId: booking.id,
  })

  return `/admin/drug-test-upload?${params.toString()}`
}
