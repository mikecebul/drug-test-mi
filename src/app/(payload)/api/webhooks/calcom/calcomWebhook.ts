import crypto from 'crypto'
import type { RequiredDataFromCollectionSlug } from 'payload'

export type CalcomWebhookTrigger =
  | 'BOOKING_CREATED'
  | 'BOOKING_CANCELLED'
  | 'BOOKING_RESCHEDULED'
  | 'BOOKING_REJECTED'
  | 'BOOKING_REQUESTED'
  | 'BOOKING_CONFIRMED'
  | 'BOOKING_PAYMENT_INITIATED'
  | 'BOOKING_PAID'
  | 'BOOKING_NO_SHOW_UPDATED'
  | 'MEETING_STARTED'
  | 'MEETING_ENDED'
  | 'RECORDING_READY'
  | 'FORM_SUBMITTED'
  | 'INSTANT_MEETING'
  | 'INSTANT_MEETING_CREATED'

export interface CalcomWebhookPayload {
  triggerEvent: CalcomWebhookTrigger
  createdAt: string
  payload: {
    id?: number | string
    type?: string
    title?: string
    description?: string
    additionalNotes?: string
    customInputs?: Record<string, unknown>
    startTime?: string
    endTime?: string
    start?: string
    end?: string
    organizer?: {
      id?: number
      name?: string
      email?: string
      username?: string
      timeZone?: string
      timeFormat?: string
      language?: {
        locale: string
      }
    }
    responses?: {
      name?:
        | {
            label: string
            value: string
          }
        | string
      email?:
        | {
            label: string
            value: string
          }
        | string
      location?:
        | {
            label: string
            value: string | { optionValue?: string; value?: string }
          }
        | string
      [key: string]: unknown
    }
    uid?: string
    bookingUid?: string
    rescheduleUid?: string
    eventTypeId?: number
    price?: number | string
    currency?: string
    paymentId?: string
    payment?: Record<string, unknown>
    metadata?: Record<string, unknown>
    bookerUrl?: string
    attendees?: Array<{
      name?: string
      email?: string
      timeZone?: string
    }>
    location?: string
    destinationCalendar?: unknown
    hideCalendarNotes?: boolean
    requiresConfirmation?: boolean
    seatsShowAttendees?: boolean
    seatsPerTimeSlot?: number
    seatsShowAvailabilityCount?: boolean
    schedulingType?: string
    iCalUID?: string
    iCalSequence?: number
    conferenceData?: unknown
    cancellationReason?: string
    reschedulingReason?: string
  }
}

type ExistingPayment = {
  amountDue?: number | null
  amountPaid?: number | null
  method?: 'cash' | 'card' | 'pre-paid' | 'not-paid' | null
  status?: 'paid' | 'partial' | 'unpaid' | null
  collectedAt?: string | null
  notes?: string | null
} | null

export type CalcomBookingData = RequiredDataFromCollectionSlug<'bookings'>
type BookingStatus = CalcomBookingData['status']
type ExistingBookingData = {
  title?: string | null
  type?: string | null
  description?: string | null
  additionalNotes?: string | null
  startTime?: string | null
  endTime?: string | null
  attendeeName?: string | null
  attendeeEmail?: string | null
  location?: string | null
  organizer?: CalcomBookingData['organizer'] | null
  customInputs?: CalcomBookingData['customInputs']
}

export const handledCalcomBookingEvents = new Set<CalcomWebhookTrigger>([
  'BOOKING_CREATED',
  'BOOKING_CANCELLED',
  'BOOKING_RESCHEDULED',
  'BOOKING_REJECTED',
  'BOOKING_REQUESTED',
  'BOOKING_CONFIRMED',
  'BOOKING_PAYMENT_INITIATED',
  'BOOKING_PAID',
])

export function allowsUnsignedCalcomWebhooks() {
  return process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test'
}

export function verifyCalcomWebhookSignature(rawBody: string, signatureHeader: string | null, secret?: string) {
  if (!secret) return allowsUnsignedCalcomWebhooks()
  if (!signatureHeader) return false

  const signature = signatureHeader.startsWith('sha256=') ? signatureHeader.slice('sha256='.length) : signatureHeader

  if (!/^[a-f0-9]{64}$/i.test(signature)) return false

  const expectedSignature = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
  const signatureBuffer = Buffer.from(signature, 'hex')
  const expectedBuffer = Buffer.from(expectedSignature, 'hex')

  return signatureBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
}

function getResponseValue(value: unknown): string | null {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object' && 'value' in value) {
    const responseValue = value.value
    if (typeof responseValue === 'string') return responseValue
  }
  return null
}

function getNestedString(input: unknown, keys: string[]): string | null {
  let current = input

  for (const key of keys) {
    if (!current || typeof current !== 'object' || !(key in current)) return null
    current = (current as Record<string, unknown>)[key]
  }

  return typeof current === 'string' && current.trim() ? current : null
}

export function getCalcomBookingUid(payload: CalcomWebhookPayload['payload']) {
  return (
    payload.uid ||
    payload.bookingUid ||
    getNestedString(payload.payment, ['bookingUid']) ||
    getNestedString(payload.payment, ['booking', 'uid']) ||
    getNestedString(payload.metadata, ['bookingUid'])
  )
}

export function getCalcomBookingNumericId(payload: CalcomWebhookPayload['payload']) {
  const id =
    getNumberLike(payload.id) ?? getNumberLike(payload.metadata?.id) ?? getNumberLike(payload.metadata?.bookingId)
  return typeof id === 'number' && Number.isInteger(id) ? id : null
}

export function getCalcomRescheduleUid(payload: CalcomWebhookPayload['payload']) {
  return payload.rescheduleUid || getNestedString(payload.metadata, ['rescheduleUid'])
}

const scheduledTestResponseKeys = new Set(['test', 'testtype', 'test_type', 'scheduledtesttype', 'scheduled_test_type'])

function normalizeResponseKey(value: string) {
  return value.replace(/[^a-z0-9_]/gi, '').toLowerCase()
}

function getResponseText(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null

  if (Array.isArray(value)) {
    for (const item of value) {
      const text = getResponseText(item)
      if (text) return text
    }
    return null
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return getResponseText(record.value) || getResponseText(record.optionValue)
  }

  return null
}

export function getCalcomScheduledTestAnswer(payload: CalcomWebhookPayload['payload']) {
  const sources = [payload.responses, payload.customInputs]

  for (const source of sources) {
    if (!source || typeof source !== 'object') continue

    for (const [key, value] of Object.entries(source)) {
      if (!scheduledTestResponseKeys.has(normalizeResponseKey(key))) continue

      const answer = getResponseText(value)
      if (answer) return answer
    }
  }

  for (const source of sources) {
    if (!source || typeof source !== 'object') continue

    for (const value of Object.values(source)) {
      if (!value || typeof value !== 'object') continue

      const label = getResponseText((value as Record<string, unknown>).label)
      if (!label || !/\btest\b/i.test(label)) continue

      const answer = getResponseText(value)
      if (answer) return answer
    }
  }

  return null
}

function getCalcomPaymentId(payload: CalcomWebhookPayload['payload']) {
  return (
    payload.paymentId ||
    getNestedString(payload.payment, ['id']) ||
    getNestedString(payload.payment, ['paymentId']) ||
    getNestedString(payload.payment, ['stripePaymentIntentId']) ||
    getNestedString(payload.payment, ['stripeChargeId']) ||
    getNestedString(payload.metadata, ['paymentId'])
  )
}

function getNumberLike(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function getCalcomAmount(payload: CalcomWebhookPayload['payload']) {
  return (
    getNumberLike(payload.price) ??
    getNumberLike(payload.payment?.amount) ??
    getNumberLike(payload.payment?.amountPaid) ??
    getNumberLike(payload.payment?.price) ??
    getNumberLike(payload.metadata?.price) ??
    getNumberLike(payload.metadata?.amount)
  )
}

export function normalizeCalcomMoney(value: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null

  // Cal.com/Stripe payloads commonly send cents, while our workflow stores dollars.
  // Drug-test prices are small enough that 3500 is almost certainly $35.00, not $3,500.
  if (Number.isInteger(value) && Math.abs(value) >= 1000) {
    return value / 100
  }

  return value
}

function hasPaidPaymentStatus(payload: CalcomWebhookPayload['payload']) {
  const paymentStatus = getNestedString(payload.payment, ['status'])?.toLowerCase()
  const metadataStatus = getNestedString(payload.metadata, ['paymentStatus'])?.toLowerCase()
  const status = paymentStatus || metadataStatus

  return ['paid', 'succeeded', 'success', 'complete', 'completed'].includes(status || '')
}

export function buildCalcomPaymentUpdate(
  triggerEvent: CalcomWebhookTrigger,
  payload: CalcomWebhookPayload['payload'],
  existingPayment?: ExistingPayment,
  receivedAt?: string,
) {
  const paymentId = getCalcomPaymentId(payload)
  const amount = normalizeCalcomMoney(getCalcomAmount(payload))
  const isPaid = triggerEvent === 'BOOKING_PAID' || hasPaidPaymentStatus(payload)
  const isPaymentEvent = triggerEvent === 'BOOKING_PAID' || triggerEvent === 'BOOKING_PAYMENT_INITIATED'

  if (!isPaymentEvent && !paymentId && amount === null && !isPaid) {
    return undefined
  }

  const amountDue = existingPayment?.amountDue ?? amount ?? existingPayment?.amountPaid ?? 0
  const previousAmountPaid = existingPayment?.amountPaid ?? 0
  const amountPaid = isPaid ? (amount ?? amountDue) : previousAmountPaid
  const currency = payload.currency || getNestedString(payload.payment, ['currency'])
  const notes = [
    existingPayment?.notes,
    paymentId ? `Cal.com payment ${paymentId}` : null,
    currency ? `Currency: ${currency.toUpperCase()}` : null,
  ]
    .filter(Boolean)
    .join('\n')

  return {
    amountDue,
    amountPaid,
    method: (isPaid ? 'pre-paid' : existingPayment?.method || 'card') as 'pre-paid' | 'card',
    status: (isPaid ? 'paid' : existingPayment?.status || 'unpaid') as 'paid' | 'partial' | 'unpaid',
    collectedAt: isPaid
      ? existingPayment?.collectedAt || receivedAt || new Date().toISOString()
      : existingPayment?.collectedAt || null,
    notes: notes || null,
  }
}

export function getBookingStatus(triggerEvent: CalcomWebhookTrigger): BookingStatus {
  if (triggerEvent === 'BOOKING_CANCELLED') return 'cancelled'
  if (triggerEvent === 'BOOKING_REJECTED') return 'rejected'
  if (triggerEvent === 'BOOKING_REQUESTED') return 'pending'
  return 'confirmed'
}

export function buildCalcomBookingData(
  webhookData: CalcomWebhookPayload,
  existingPayment?: ExistingPayment,
  existingBooking?: ExistingBookingData | null,
): CalcomBookingData {
  const { triggerEvent, payload } = webhookData
  const attendee = payload.attendees?.[0]
  const attendeeName =
    getResponseValue(payload.responses?.name) || attendee?.name || existingBooking?.attendeeName || 'Unknown'
  const attendeeEmail =
    getResponseValue(payload.responses?.email) || attendee?.email || existingBooking?.attendeeEmail || ''
  const locationValue = getResponseValue(payload.responses?.location)
  const location = locationValue || payload.location || existingBooking?.location || ''
  const uid = getCalcomBookingUid(payload)
  const rescheduleUid = getCalcomRescheduleUid(payload)
  const numericId = getCalcomBookingNumericId(payload)
  const payment = buildCalcomPaymentUpdate(triggerEvent, payload, existingPayment, webhookData.createdAt)
  const receivedAt = new Date(webhookData.createdAt).toISOString()
  const startTime = payload.startTime || payload.start || existingBooking?.startTime || receivedAt
  const endTime =
    payload.endTime || payload.end || payload.startTime || payload.start || existingBooking?.endTime || startTime

  const bookingData: CalcomBookingData = {
    title: payload.title || existingBooking?.title || 'Drug test appointment',
    type: payload.type || existingBooking?.type || 'calcom-booking',
    description: payload.description || existingBooking?.description || null,
    additionalNotes:
      payload.additionalNotes ||
      payload.reschedulingReason ||
      payload.cancellationReason ||
      existingBooking?.additionalNotes ||
      null,
    startTime,
    endTime,
    status: getBookingStatus(triggerEvent),
    organizer: {
      id: payload.organizer?.id || existingBooking?.organizer?.id || null,
      name: payload.organizer?.name || existingBooking?.organizer?.name || 'MI Drug Test',
      email: payload.organizer?.email || existingBooking?.organizer?.email || 'booking@midrugtest.com',
      username: payload.organizer?.username || existingBooking?.organizer?.username || null,
      timeZone: payload.organizer?.timeZone || existingBooking?.organizer?.timeZone || null,
      timeFormat: payload.organizer?.timeFormat || existingBooking?.organizer?.timeFormat || null,
    },
    attendeeName,
    attendeeEmail,
    location: location || null,
    calcomBookingId: uid || null,
    calcomBookingNumericId: numericId,
    calcomRescheduledFromId: rescheduleUid || null,
    calcomPaymentId: getCalcomPaymentId(payload) || null,
    eventTypeId: payload.eventTypeId || null,
    customInputs: (payload.customInputs ||
      payload.responses ||
      existingBooking?.customInputs ||
      null) as CalcomBookingData['customInputs'],
    webhookData: webhookData as unknown as CalcomBookingData['webhookData'],
    createdViaWebhook: true,
  }

  if (payment) {
    bookingData.payment = payment
  }

  return bookingData
}
