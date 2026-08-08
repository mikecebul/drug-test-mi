'use server'

import { getPayload, type PayloadRequest, type RequiredDataFromCollectionSlug } from 'payload'
import config from '@payload-config'
import Stripe from 'stripe'
import type { Booking as PayloadBooking, Client, Court, Employer, Payment } from '@/payload-types'
import { APP_TIMEZONE, getAppTimezoneDayWindow } from '@/lib/date-utils'
import { getBookingGenderFromInputs } from '@/lib/client-gender'
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
} from '@/config/test-types'
import { getCalcomBookingActionLinks, isPastScheduledBookingTime } from './schedule-utils'
import {
  applyAvailableClientCredit,
  applyIncomingPayment,
  normalizeMoney,
} from '@/collections/Payments/services/applyPayment'
import { reversePostedPayments } from '@/collections/Payments/services/reversePayments'
import { withPayloadTransaction } from '@/collections/Payments/services/withPayloadTransaction'
import {
  cancelGuidedTerminalPayment,
  getGuidedTerminalPaymentStatus,
  startGuidedTerminalPayment,
} from '@/collections/Payments/services/stripeTerminal'
import {
  classifyPaymentReceipt,
  resolveClientReceiptEmail,
  sendClientPaymentReceipt,
} from '@/collections/Payments/services/clientReceipt'
import {
  findRefundableCalcomBookingPayment,
  syncCalcomPrepaidBookingPayment,
} from '@/collections/Payments/services/calcomBookingPayment'
import { cancelCalcomBooking } from '@/utilities/calcom-api'
import { isRedwoodAutomationEnabled, REDWOOD_TASK_RETRIES } from '@/lib/redwood/config'
import { resolveClientRedwoodEligibleDefaultTest } from '@/lib/redwood/default-test'
import {
  queueRedwoodDefaultTestSync,
  queueRedwoodHeadshotUpload,
  queueRedwoodImportForClient,
} from '@/lib/redwood/queue'
import { deriveRedwoodProvisioningStatus, type RedwoodProvisioningStatus } from '@/lib/redwood/provisioning'
import { buildRedwoodCollectSpecimenUrl, REDWOOD_MOBILE_DONORS_URL } from '@/lib/redwood/donor-urls'
import { getBookingPaymentAfterRefund } from './refund-state'
import {
  hasReadyGuidedRedwoodDonor,
  shouldQueueGuidedRedwoodDonor,
  shouldTreatGuidedRedwoodImportAsFailed,
} from './redwood-provisioning-state'

type PaymentStatus = 'paid' | 'partial' | 'unpaid'
type PaymentMethod = 'cash' | 'card' | 'credit' | 'not-paid' | 'pre-paid'
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
  refundStatus?: 'pending' | 'requires-action' | 'succeeded' | 'failed' | 'cancelled'
}

export type GuidedRedwoodProvisioningStatus = RedwoodProvisioningStatus & {
  collectSpecimenHref: string | null
  manualHref: string
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
      warning: "Cal.com says this booking is past its scheduled time, so it was removed from today's schedule locally.",
    }
  }

  return {
    success: false,
    error: result.error || 'Cal.com cancellation failed.',
    fallbackHref: getCancelHref(booking),
  }
}

function getStoredStripeRefundStatus(status: Stripe.Refund['status']): NonNullable<Payment['stripeRefundStatus']> {
  if (status === 'requires_action') return 'requires-action'
  if (status === 'canceled') return 'cancelled'
  if (status === 'succeeded' || status === 'failed' || status === 'pending') return status
  return 'pending'
}

function getStripePaymentDashboardHref(paymentIntentId: string) {
  return `https://dashboard.stripe.com/payments/${encodeURIComponent(paymentIntentId)}`
}

async function updateCollectedDrugTestAfterRefund(input: {
  booking: PayloadBooking
  payload: Payload
  refundAmount: number
  req: PayloadRequest
}) {
  if (input.booking.sampleCollection?.status !== 'collected') return

  const linkedDrugTestId = getRelationshipId(input.booking.sampleCollection.drugTest)
  const drugTests = linkedDrugTestId
    ? [
        await input.payload.findByID({
          collection: 'drug-tests',
          id: linkedDrugTestId,
          depth: 0,
          overrideAccess: true,
          req: input.req,
        }),
      ]
    : (
        await input.payload.find({
          collection: 'drug-tests',
          where: { sourceBooking: { equals: input.booking.id } },
          depth: 0,
          limit: 1,
          overrideAccess: true,
          req: input.req,
        })
      ).docs
  const drugTest = drugTests[0]
  if (!drugTest?.payment) return

  const amountDue = normalizeMoney(drugTest.payment.amountDue)
  const amountPaid = normalizeMoney(drugTest.payment.amountPaid)
  const nextAmountDue = Math.max(0, normalizeMoney(amountDue - input.refundAmount))
  const nextAmountPaid = Math.max(0, normalizeMoney(amountPaid - input.refundAmount))
  const balanceDue = Math.max(0, normalizeMoney(nextAmountDue - nextAmountPaid))

  await input.payload.update({
    collection: 'drug-tests',
    id: drugTest.id,
    data: {
      payment: {
        ...drugTest.payment,
        amountDue: nextAmountDue,
        amountPaid: nextAmountPaid,
        balanceDue,
        status: balanceDue <= 0 ? 'paid' : nextAmountPaid > 0 ? 'partial' : 'unpaid',
      },
    },
    depth: 0,
    overrideAccess: true,
    req: input.req,
  })
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

async function recordSucceededBookingRefund(input: {
  bookingId: string
  operationId: string
  payload: Payload
  refund: Stripe.Refund
  stripePaymentId: string
}) {
  return withPayloadTransaction(input.payload, async (req) => {
    const payment = (await input.payload.findByID({
      collection: 'payments',
      id: input.stripePaymentId,
      depth: 0,
      overrideAccess: true,
      req,
    })) as Payment

    if (
      payment.stripeRefundId === input.refund.id &&
      payment.stripeRefundOperationId === input.operationId &&
      payment.stripeRefundStatus === 'succeeded'
    ) {
      return { applied: false, refundedAmount: normalizeMoney(input.refund.amount / 100) }
    }

    const booking = (await input.payload.findByID({
      collection: 'bookings',
      id: input.bookingId,
      depth: 0,
      overrideAccess: true,
      req,
    })) as PayloadBooking
    const priorRefundedAmount = normalizeMoney(payment.refundedAmount)
    const remainingRefundableAmount = Math.max(0, normalizeMoney(payment.amount - priorRefundedAmount))
    const refundedAmount = Math.min(remainingRefundableAmount, normalizeMoney(input.refund.amount / 100))

    if (refundedAmount <= 0) {
      return { applied: false, refundedAmount: 0 }
    }

    const totalRefundedAmount = normalizeMoney(priorRefundedAmount + refundedAmount)
    const fullyRefunded = totalRefundedAmount >= normalizeMoney(payment.amount)
    const refundedAt = new Date().toISOString()

    await input.payload.update({
      collection: 'payments',
      id: payment.id,
      data: {
        status: fullyRefunded ? 'refunded' : 'posted',
        refundedAt,
        refundedAmount: totalRefundedAmount,
        stripeRefundId: input.refund.id,
        stripeRefundOperationId: input.operationId,
        stripeRefundStatus: 'succeeded',
        pendingRefundAmount: 0,
      },
      depth: 0,
      overrideAccess: true,
      req,
    })

    await updateCollectedDrugTestAfterRefund({
      booking,
      payload: input.payload,
      refundAmount: refundedAmount,
      req,
    })

    await input.payload.update({
      collection: 'bookings',
      id: input.bookingId,
      data: {
        payment: getBookingPaymentAfterRefund(booking, refundedAmount),
      },
      depth: 0,
      overrideAccess: true,
      req,
    })

    return { applied: true, refundedAmount }
  })
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

function getCalcomBookingGender(booking: { customInputs?: unknown; webhookData?: unknown }) {
  const webhookPayload = getWebhookPayload(booking.webhookData)

  return (
    getBookingGenderFromInputs(webhookPayload.customInputs) ||
    getBookingGenderFromInputs(webhookPayload.responses) ||
    getBookingGenderFromInputs(booking.customInputs)
  )
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

async function getFirstDrugTestDates(payload: Payload, clientIds: string[]) {
  const datesByClientId = new Map<string, string>()
  if (clientIds.length === 0) return datesByClientId

  const result = await payload.find({
    collection: 'drug-tests',
    where: {
      relatedClient: {
        in: clientIds,
      },
    },
    depth: 0,
    limit: 1000,
    sort: 'collectionDate',
    overrideAccess: true,
  })

  for (const test of result.docs) {
    const clientId = getRelationshipId(test.relatedClient)
    if (!clientId || datesByClientId.has(clientId)) continue
    datesByClientId.set(clientId, test.collectionDate || test.createdAt)
  }

  return datesByClientId
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
          or: [
            {
              status: {
                in: ['confirmed', 'pending'],
              },
            },
            {
              'sampleCollection.status': {
                equals: 'collected',
              },
            },
          ],
        },
      ],
    },
    depth: 2,
    limit: 100,
    sort: 'startTime',
    overrideAccess: true,
  })

  const bookingIds = result.docs.map((booking) => String(booking.id))
  const clientIds = Array.from(
    new Set(
      result.docs
        .map((booking) => getRelationshipId(booking.relatedClient))
        .filter((clientId): clientId is string => Boolean(clientId)),
    ),
  )
  const firstDrugTestDatesPromise = getFirstDrugTestDates(payload, clientIds)
  const guidedPaymentSummaries = new Map<
    string,
    {
      newMoneyAmount: number
      creditAppliedAmount: number
      appliedToBookingAmount: number
      appliedToPreviousBalancesAmount: number
      creditCreatedAmount: number
      method: Payment['method']
      collectedAt: string | null
    }
  >()

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
              in: ['guided-workflow', 'credit-application'],
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
      const current = guidedPaymentSummaries.get(relatedBookingId) || {
        newMoneyAmount: 0,
        creditAppliedAmount: 0,
        appliedToBookingAmount: 0,
        appliedToPreviousBalancesAmount: 0,
        creditCreatedAmount: 0,
        method: payment.method,
        collectedAt: null,
      }
      const collectedAt = payment.collectedAt || payment.createdAt

      guidedPaymentSummaries.set(relatedBookingId, {
        newMoneyAmount: normalizeMoney(
          current.newMoneyAmount + (payment.source === 'guided-workflow' ? normalizeMoney(payment.amount) : 0),
        ),
        creditAppliedAmount: normalizeMoney(
          current.creditAppliedAmount + (payment.source === 'credit-application' ? normalizeMoney(payment.amount) : 0),
        ),
        appliedToBookingAmount: normalizeMoney(
          current.appliedToBookingAmount + normalizeMoney(payment.reservedForBookingAmount),
        ),
        appliedToPreviousBalancesAmount: normalizeMoney(
          current.appliedToPreviousBalancesAmount + normalizeMoney(payment.appliedAmount),
        ),
        creditCreatedAmount: normalizeMoney(current.creditCreatedAmount + normalizeMoney(payment.creditAmount)),
        method: payment.source === 'guided-workflow' ? payment.method : current.method,
        collectedAt:
          !current.collectedAt || new Date(collectedAt).getTime() > new Date(current.collectedAt).getTime()
            ? collectedAt
            : current.collectedAt,
      })
    }
  }

  return Promise.all(
    result.docs.map(async (booking) => {
      const client = typeof booking.relatedClient === 'object' ? (booking.relatedClient as PopulatedClient) : null
      const referral = await resolveReferral(payload, client)
      const scheduledTestType = mapTestTypeValue(booking.scheduledTestType)
      const calcomTestType = getCalcomBookingTestType(booking)
      const bookingTestType = scheduledTestType ?? calcomTestType

      const referralTestType = getPreferredTestType(referral)
      const testType = bookingTestType ?? referralTestType
      const referralType = client?.referralType as 'court' | 'employer' | 'self' | undefined
      const firstDrugTestDates = await firstDrugTestDatesPromise
      const firstDrugTestDate = firstDrugTestDates.get(String(client?.id || '')) || null
      const headshot =
        client?.headshot && typeof client.headshot === 'object'
          ? client.headshot.thumbnailURL || client.headshot.url || null
          : null
      const headshotId = client?.headshot && typeof client.headshot === 'object' ? String(client.headshot.id) : null
      const bookingGender = getCalcomBookingGender(booking)

      return {
        id: booking.id as string,
        title: booking.title as string,
        startTime: booking.startTime as string,
        endTime: booking.endTime as string,
        attendeeName: booking.attendeeName as string,
        attendeeEmail: booking.attendeeEmail as string,
        attendeePhone: getPhoneFromCustomInputs(booking.customInputs),
        gender:
          client?.gender === 'male' || client?.gender === 'female' || client?.gender === 'prefer-not-to-say'
            ? client.gender
            : bookingGender || null,
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
              disableClientEmails: Boolean(client.disableClientEmails),
              dob: typeof client.dob === 'string' ? client.dob : null,
              gender: typeof client.gender === 'string' ? client.gender : null,
              phone: typeof client.phone === 'string' ? client.phone : null,
              headshot,
              headshotId,
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
        guidedPaymentTotal: guidedPaymentSummaries.get(String(booking.id))?.newMoneyAmount || 0,
        guidedPaymentSummary: guidedPaymentSummaries.get(String(booking.id)) || null,
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

async function loadClientRedwoodProvisioningStatus(
  payload: Payload,
  clientId: string,
  testTypeValue?: string,
): Promise<GuidedRedwoodProvisioningStatus> {
  const [client, importRuns, payloadImportJobs] = await Promise.all([
    payload.findByID({
      collection: 'clients',
      id: clientId,
      depth: 1,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'job-runs',
      where: {
        and: [
          {
            client: {
              equals: clientId,
            },
          },
          {
            taskSlug: {
              equals: 'redwood-import-client',
            },
          },
        ],
      },
      sort: '-createdAt',
      limit: 1,
      depth: 0,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'payload-jobs',
      where: {
        and: [
          {
            'input.clientId': {
              equals: clientId,
            },
          },
          {
            taskSlug: {
              equals: 'redwood-import-client',
            },
          },
        ],
      },
      sort: '-createdAt',
      limit: 1,
      depth: 0,
      overrideAccess: true,
    }),
  ])
  const latestImportRun = importRuns.docs[0]
  const latestPayloadImportJob = payloadImportJobs.docs[0]
  const importRetriesExhausted =
    latestPayloadImportJob?.hasError === true ||
    (latestImportRun?.status === 'failed' &&
      typeof latestImportRun.attemptCount === 'number' &&
      latestImportRun.attemptCount >= REDWOOD_TASK_RETRIES)
  const unresolvedImportFailure = shouldTreatGuidedRedwoodImportAsFailed({
    donorId: client.redwoodDonorId,
    importRetriesExhausted,
    syncStatus: client.redwoodSyncStatus,
  })
  const defaultTestResolution = await resolveClientRedwoodEligibleDefaultTest({
    client,
    payload,
  })
  const defaultTestRequired = defaultTestResolution.kind === 'eligible' || defaultTestResolution.kind === 'error'
  const headshotRequired = Boolean(getRelationshipId(client.headshot))
  const lastError =
    (unresolvedImportFailure ? latestImportRun?.errorMessage : null) ||
    client.redwoodLastError ||
    client.redwoodDefaultTestLastError ||
    client.redwoodHeadshotPushLastError ||
    (defaultTestResolution.kind === 'error' ? defaultTestResolution.reason : null)

  const provisioning = deriveRedwoodProvisioningStatus({
    automationEnabled: isRedwoodAutomationEnabled(),
    callInCode: client.redwoodCallInCode,
    defaultTestRequired,
    defaultTestStatus:
      defaultTestResolution.kind === 'error' && client.redwoodDefaultTestSyncStatus === 'not-queued'
        ? 'failed'
        : client.redwoodDefaultTestSyncStatus,
    donorId: client.redwoodDonorId,
    headshotRequired,
    headshotStatus: client.redwoodHeadshotPushStatus,
    lastError,
    syncStatus: unresolvedImportFailure ? 'failed' : client.redwoodSyncStatus,
  })
  const collectionTestType = mapTestTypeValue(testTypeValue)

  return {
    ...provisioning,
    collectSpecimenHref:
      provisioning.donorId && collectionTestType
        ? buildRedwoodCollectSpecimenUrl(
            REDWOOD_MOBILE_DONORS_URL,
            provisioning.donorId,
            collectionTestType.category === 'instant',
          )
        : null,
    manualHref: REDWOOD_MOBILE_DONORS_URL,
  }
}

export async function getClientRedwoodProvisioningStatus(
  clientId: string,
  testTypeValue: string,
  req?: AdminPayloadRequest,
): Promise<GuidedRedwoodProvisioningStatus> {
  if (!clientId) {
    throw new Error('Client ID is required.')
  }

  const payload = await getAdminPayload(req)
  return loadClientRedwoodProvisioningStatus(payload, clientId, testTypeValue)
}

async function queueMissingRedwoodProvisioningWork(args: {
  clientId: string
  payload: Payload
  retryFailedDonor: boolean
}): Promise<void> {
  const client = await args.payload.findByID({
    collection: 'clients',
    id: args.clientId,
    depth: 1,
    overrideAccess: true,
  })
  const donorReady = hasReadyGuidedRedwoodDonor({
    donorId: client.redwoodDonorId,
    syncStatus: client.redwoodSyncStatus,
  })

  if (!donorReady) {
    const canQueueDonor = shouldQueueGuidedRedwoodDonor({
      retryFailedDonor: args.retryFailedDonor,
      syncStatus: client.redwoodSyncStatus,
    })

    if (canQueueDonor) {
      await queueRedwoodImportForClient(args.clientId, 'guided-workflow', args.payload)
    }

    return
  }

  const defaultTestResolution = await resolveClientRedwoodEligibleDefaultTest({
    client,
    payload: args.payload,
  })
  if (
    defaultTestResolution.kind === 'eligible' &&
    !['queued', 'synced'].includes(client.redwoodDefaultTestSyncStatus || '')
  ) {
    await queueRedwoodDefaultTestSync(args.clientId, args.payload)
  }

  if (getRelationshipId(client.headshot) && !['queued', 'synced'].includes(client.redwoodHeadshotPushStatus || '')) {
    await queueRedwoodHeadshotUpload(args.clientId, undefined, args.payload)
  }
}

async function applyGuidedLabDefaultTest(args: {
  clientId: string
  payload: Payload
  testTypeValue?: string
}): Promise<void> {
  const testType = mapTestTypeValue(args.testTypeValue)
  if (!testType || testType.category !== 'lab') {
    return
  }

  const client = await args.payload.findByID({
    collection: 'clients',
    id: args.clientId,
    depth: 1,
    overrideAccess: true,
  })
  const currentTestType = mapTestTypeValue(client.defaultTestType)
  if (currentTestType?.value === testType.value) {
    return
  }

  await args.payload.update({
    collection: 'clients',
    id: args.clientId,
    data: {
      defaultTestType: testType.value,
    },
    overrideAccess: true,
  })
}

export async function ensureClientRedwoodProvisioning(
  clientId: string,
  testTypeValue: string,
  req?: AdminPayloadRequest,
): Promise<{
  error?: string
  success: boolean
}> {
  try {
    if (!isRedwoodAutomationEnabled()) {
      return {
        success: false,
        error: 'Redwood automation is disabled on this server.',
      }
    }

    const payload = await getAdminPayload(req)
    await applyGuidedLabDefaultTest({
      clientId,
      payload,
      testTypeValue,
    })

    await queueMissingRedwoodProvisioningWork({
      clientId,
      payload,
      retryFailedDonor: false,
    })

    return {
      success: true,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to queue Redwood donor provisioning.',
    }
  }
}

export async function retryClientRedwoodProvisioning(clientId: string): Promise<{
  error?: string
  status?: GuidedRedwoodProvisioningStatus
  success: boolean
}> {
  const payload = await getAdminPayload()

  try {
    if (!isRedwoodAutomationEnabled()) {
      throw new Error('Redwood automation is disabled on this server.')
    }

    await queueMissingRedwoodProvisioningWork({
      clientId,
      payload,
      retryFailedDonor: true,
    })

    return {
      success: true,
      status: await loadClientRedwoodProvisioningStatus(payload, clientId),
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to retry Redwood donor provisioning.',
      status: await loadClientRedwoodProvisioningStatus(payload, clientId).catch(() => undefined),
    }
  }
}

export async function getClientOutstandingPaymentBalances(clientId: string, req?: AdminPayloadRequest) {
  if (!clientId) return []

  const payload = await getAdminPayload(req)
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

export async function getClientReferralProfile(clientId: string, req?: AdminPayloadRequest) {
  if (!clientId) return null

  const payload = await getAdminPayload(req)
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
    gender: getCalcomBookingGender(booking),
    phone: getPhoneFromCustomInputs(booking.customInputs),
  }
}

export async function linkBookingToClient(bookingId: string, clientId: string, req?: AdminPayloadRequest) {
  const payload = await getAdminPayload(req)
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

export async function setBookingScheduledTestType(bookingId: string, testTypeId: string, req?: AdminPayloadRequest) {
  if (!bookingId || !testTypeId) {
    return { success: false, error: 'Booking and test type are required.' }
  }

  const mappedTestType = mapTestTypeValue(testTypeId)
  if (!mappedTestType) {
    return { success: false, error: 'Select a valid test type.' }
  }

  const payload = await getAdminPayload(req)
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

export async function createWalkInBooking(input: { clientId: string }, req?: AdminPayloadRequest) {
  if (!input.clientId) {
    return { success: false, error: 'Client is required.' }
  }

  const payload = await getAdminPayload(req)
  const client = await payload.findByID({
    collection: 'clients',
    id: input.clientId,
    depth: 2,
    overrideAccess: true,
  })
  const referral = await resolveReferral(payload, client as PopulatedClient)
  const preferredTestType = getPreferredTestType(referral)
  const activePreferredTestType = preferredTestType
    ? getActiveTestTypes().find((testType) => testType.value === preferredTestType.value)
    : undefined
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
    ...(activePreferredTestType ? { scheduledTestType: activePreferredTestType.value } : {}),
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

export async function cancelGuidedBooking(
  input: { bookingId: string },
  req?: AdminPayloadRequest,
): Promise<ScheduleActionResult> {
  if (!input.bookingId) {
    return { success: false, error: 'Booking is required.' }
  }

  const payload = await getAdminPayload(req)
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

export async function cancelAndRefundGuidedBooking(
  input: { bookingId: string; operationId: string; refundAmount: number },
  req?: AdminPayloadRequest,
): Promise<ScheduleActionResult> {
  if (!input.bookingId) {
    return { success: false, error: 'Booking is required.' }
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return { success: false, error: 'Stripe secret key is not configured.' }
  }

  if (!input.operationId?.trim()) {
    return { success: false, error: 'A refund operation ID is required.' }
  }

  const requestedRefundAmount = normalizeMoney(input.refundAmount)
  if (!Number.isFinite(input.refundAmount) || requestedRefundAmount <= 0) {
    return { success: false, error: 'Refund amount must be greater than zero.' }
  }

  const payload = await getAdminPayload(req)
  const booking = (await payload.findByID({
    collection: 'bookings',
    id: input.bookingId,
    depth: 0,
    overrideAccess: true,
  })) as PayloadBooking

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

  const alreadyRefundedAmount = normalizeMoney(refundablePayment.refundedAmount)
  const remainingRefundableAmount = Math.max(
    0,
    normalizeMoney(normalizeMoney(refundablePayment.amount) - alreadyRefundedAmount),
  )
  if (remainingRefundableAmount <= 0) {
    return { success: false, error: 'This Stripe payment has already been fully refunded.' }
  }
  if (requestedRefundAmount > remainingRefundableAmount) {
    return {
      success: false,
      error: `Refund amount cannot exceed $${remainingRefundableAmount.toFixed(2)}.`,
    }
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

  const stripeDashboardHref = getStripePaymentDashboardHref(paymentIntentId)
  if (
    refundablePayment.stripeRefundOperationId === input.operationId &&
    refundablePayment.stripeRefundStatus === 'succeeded'
  ) {
    return {
      success: true,
      refundedAmount: requestedRefundAmount,
      refundStatus: 'succeeded',
    }
  }

  let refund: Stripe.Refund
  let refundOperationId = input.operationId

  try {
    const unresolvedRefundStatus =
      refundablePayment.stripeRefundStatus === 'pending' ||
      refundablePayment.stripeRefundStatus === 'requires-action'
    const isRetry =
      refundablePayment.stripeRefundOperationId === input.operationId && Boolean(refundablePayment.stripeRefundId)

    if ((unresolvedRefundStatus || isRetry) && refundablePayment.stripeRefundId) {
      refundOperationId = refundablePayment.stripeRefundOperationId || input.operationId
      refund = await stripe.refunds.retrieve(refundablePayment.stripeRefundId)
    } else {
      refund = await stripe.refunds.create(
        {
          payment_intent: paymentIntentId,
          amount: Math.round(requestedRefundAmount * 100),
          metadata: {
            bookingId: input.bookingId,
            integration: 'guided-booking-refund',
            paymentId: String(refundablePayment.id),
            workflowOperationId: input.operationId,
          },
        },
        {
          idempotencyKey: `guided-booking-refund-${refundablePayment.id}-${input.operationId}`,
        },
      )
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? `Stripe refund failed: ${error.message}` : 'Stripe refund failed.',
      fallbackHref: stripeDashboardHref,
    }
  }

  const refundStatus = getStoredStripeRefundStatus(refund.status)
  const refundAmount = normalizeMoney(refund.amount / 100)
  await payload.update({
    collection: 'payments',
    id: refundablePayment.id,
    data: {
      stripeRefundId: refund.id,
      stripeRefundOperationId: refundOperationId,
      stripeRefundStatus: refundStatus === 'succeeded' ? 'pending' : refundStatus,
      pendingRefundAmount:
        refundStatus === 'pending' || refundStatus === 'requires-action' || refundStatus === 'succeeded'
          ? refundAmount
          : 0,
    },
    depth: 0,
    overrideAccess: true,
  })

  if (refundStatus !== 'succeeded') {
    const statusMessage =
      refundStatus === 'failed' || refundStatus === 'cancelled'
        ? `Stripe reports that the refund ${refundStatus}. No local payment balances were changed.`
        : 'Stripe accepted the refund, but it has not completed. The appointment was not cancelled and local balances were not changed.'
    return {
      success: refundStatus === 'pending' || refundStatus === 'requires-action',
      error: refundStatus === 'failed' || refundStatus === 'cancelled' ? statusMessage : undefined,
      warning: refundStatus === 'pending' || refundStatus === 'requires-action' ? statusMessage : undefined,
      fallbackHref: stripeDashboardHref,
      refundedAmount: refundAmount,
      refundStatus,
    }
  }

  const recordedRefund = await recordSucceededBookingRefund({
    bookingId: input.bookingId,
    operationId: refundOperationId,
    payload,
    refund,
    stripePaymentId: String(refundablePayment.id),
  })
  const cancelResult = await cancelCalcomBookingIfNeeded(booking)

  if (cancelResult.success) {
    await payload.update({
      collection: 'bookings',
      id: input.bookingId,
      data: { status: 'cancelled' },
      depth: 0,
      overrideAccess: true,
    })
  }

  revalidateBookingViews()

  if (cancelResult.success && cancelResult.warning) {
    return {
      success: true,
      warning: `Refunded $${recordedRefund.refundedAmount.toFixed(2)}. ${cancelResult.warning}`,
      refundedAmount: recordedRefund.refundedAmount,
      refundStatus: 'succeeded',
    }
  }

  if (!cancelResult.success) {
    return {
      success: true,
      warning: `Refunded $${recordedRefund.refundedAmount.toFixed(2)}, but Cal.com cancellation still needs attention: ${cancelResult.error}`,
      fallbackHref: cancelResult.fallbackHref || stripeDashboardHref,
      refundedAmount: recordedRefund.refundedAmount,
      refundStatus: 'succeeded',
    }
  }

  return {
    success: true,
    refundedAmount: recordedRefund.refundedAmount,
    refundStatus: 'succeeded',
  }
}

export async function recordBookingPayment(
  input: {
    bookingId: string
    amountReceived: number
    creditApplied?: number
    method: Extract<PaymentMethod, 'cash' | 'card'>
    notes?: string
    operationId?: string
    sendReceipt?: boolean
  },
  req?: AdminPayloadRequest,
) {
  if (!input.bookingId) {
    return { success: false, error: 'Booking is required.' }
  }

  if (input.method !== 'cash' && input.method !== 'card') {
    return { success: false, error: 'Payment method must be cash or card.' }
  }

  if (!Number.isFinite(input.amountReceived) || input.amountReceived < 0) {
    return { success: false, error: 'Amount received must be zero or greater.' }
  }

  const creditApplied = normalizeMoney(input.creditApplied)
  if (!Number.isFinite(input.creditApplied ?? 0) || creditApplied < 0) {
    return { success: false, error: 'Client credit applied must be zero or greater.' }
  }

  const operationId = input.operationId?.trim() || null
  const payload = await getAdminPayload(req)
  try {
    const result = await withPayloadTransaction(payload, async (req) => {
      const existingBooking = await payload.findByID({
        collection: 'bookings',
        id: input.bookingId,
        depth: 4,
        overrideAccess: true,
        req,
      })
      if (
        operationId &&
        existingBooking.payment?.workflowOperationId === operationId &&
        existingBooking.payment.workflowOperationType === 'record-payment'
      ) {
        return { payment: existingBooking.payment, receipt: null }
      }

      const clientId = getRelationshipId(existingBooking.relatedClient)
      if (!clientId) {
        throw new Error('Select or register the client before recording payment.')
      }

      const client =
        typeof existingBooking.relatedClient === 'object' ? (existingBooking.relatedClient as PopulatedClient) : null
      const receiptEmail = client ? resolveClientReceiptEmail(client) : null
      const shouldSendReceipt = Boolean(
        input.sendReceipt &&
          input.method === 'cash' &&
          receiptEmail &&
          (normalizeMoney(input.amountReceived) > 0 || creditApplied > 0),
      )
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
      const previousBalanceBefore = shouldSendReceipt
        ? normalizeMoney(
            (
              await payload.find({
                collection: 'drug-tests',
                where: {
                  and: [
                    { relatedClient: { equals: clientId } },
                    { 'payment.balanceDue': { greater_than: 0 } },
                  ],
                },
                depth: 0,
                limit: 1000,
                overrideAccess: true,
                req,
              })
            ).docs.reduce((total, test) => total + normalizeMoney(test.payment?.balanceDue), 0),
          )
        : 0
      const notes =
        typeof input.notes === 'string'
          ? input.notes.trim() || null
          : typeof existingPayment?.notes === 'string'
            ? existingPayment.notes
            : null

      let creditAppliedToBooking = 0
      let moneyAppliedToBooking = 0
      let creditPaymentRecord: Payment | null = null
      let moneyPaymentRecord: Payment | null = null
      let clientCreditUsed = 0

      if (creditApplied > 0) {
        const creditPayment = await applyAvailableClientCredit({
          payload,
          clientId,
          amount: creditApplied,
          relatedBooking: input.bookingId,
          bookingBalanceDue: currentBookingBalance,
          allocationOrder: 'oldest-balance-first',
          req,
        })

        creditAppliedToBooking = normalizeMoney(creditPayment?.payment.reservedForBookingAmount)
        creditPaymentRecord = (creditPayment?.payment as Payment | undefined) || null
        clientCreditUsed = normalizeMoney(creditPayment?.usedCredit)
      }

      if (input.amountReceived > 0) {
        const ledgerPayment = await applyIncomingPayment({
          payload,
          clientId,
          amount: input.amountReceived,
          method: input.method,
          source: 'guided-workflow',
          relatedBooking: input.bookingId,
          bookingBalanceDue: Math.max(0, normalizeMoney(currentBookingBalance - creditAppliedToBooking)),
          allocationOrder: 'oldest-balance-first',
          req,
        })

        moneyAppliedToBooking = normalizeMoney(ledgerPayment.reservedForBookingAmount)
        moneyPaymentRecord = ledgerPayment as Payment
      }

      const amountAppliedToBooking = normalizeMoney(creditAppliedToBooking + moneyAppliedToBooking)
      const nextAmountPaid = Math.min(amountDue, normalizeMoney(existingAmountPaid + amountAppliedToBooking))
      const nextBalanceDue = Math.max(0, normalizeMoney(amountDue - nextAmountPaid))
      const bookingPaymentStatus: PaymentStatus =
        nextBalanceDue <= 0 ? 'paid' : nextAmountPaid > 0 ? 'partial' : 'unpaid'
      const bookingPaymentMethod: PaymentMethod =
        moneyAppliedToBooking > 0
          ? input.method
          : creditAppliedToBooking > 0
            ? 'credit'
            : existingAmountPaid > 0 && existingPayment?.method
              ? existingPayment.method
              : 'not-paid'

      const collectedAt = new Date().toISOString()
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
            collectedAt,
            ...(operationId
              ? {
                  workflowOperationId: operationId,
                  workflowOperationType: 'record-payment' as const,
                }
              : {}),
          },
        },
        depth: 0,
        overrideAccess: true,
        req,
      })

      const receiptPayment = moneyPaymentRecord || creditPaymentRecord
      if (!shouldSendReceipt || !receiptEmail || !client || !receiptPayment) {
        return { payment: booking.payment, receipt: null }
      }

      const appliedToPreviousBalances = normalizeMoney(
        normalizeMoney(creditPaymentRecord?.appliedAmount) + normalizeMoney(moneyPaymentRecord?.appliedAmount),
      )
      const appliedToToday = normalizeMoney(creditAppliedToBooking + moneyAppliedToBooking)
      const creditAdded = normalizeMoney(moneyPaymentRecord?.creditAmount)
      const remainingBalance = Math.max(
        0,
        normalizeMoney(previousBalanceBefore + currentBookingBalance - appliedToPreviousBalances - appliedToToday),
      )
      const clientCreditBalance = Math.max(
        0,
        normalizeMoney(normalizeMoney(client.creditBalance) - clientCreditUsed + creditAdded),
      )
      const receiptType = classifyPaymentReceipt({ creditAdded, remainingBalance })
      const paymentMethod =
        input.amountReceived > 0 && clientCreditUsed > 0
          ? 'Cash and client credit'
          : input.amountReceived > 0
            ? 'Cash'
            : 'Client credit'

      return {
        payment: booking.payment,
        receipt: {
          data: {
            appliedToPreviousBalances,
            appliedToToday,
            cashReceived: normalizeMoney(input.amountReceived),
            clientCreditApplied: clientCreditUsed,
            clientCreditBalance,
            clientName: [client.firstName, client.lastName].filter(Boolean).join(' ') || client.email,
            collectedAt,
            creditAdded,
            paymentMethod,
            receiptType,
            remainingBalance,
            testName: testType?.label || 'Drug test',
          },
          paymentId: String(receiptPayment.id),
          receiptEmail,
          receiptType,
        },
      }
    })

    revalidateBookingViews()

    let receipt:
      | { email: string; sent: true }
      | { error: string; sent: false }
      | null = null

    if (result.receipt) {
      try {
        const delivery = await sendClientPaymentReceipt({
          data: result.receipt.data,
          payload,
          receiptEmail: result.receipt.receiptEmail,
        })
        const sentAt = new Date().toISOString()

        try {
          await payload.update({
            collection: 'payments',
            id: result.receipt.paymentId,
            data: {
              receiptEmail: result.receipt.receiptEmail,
              receiptEmailSentAt: sentAt,
              receiptType: result.receipt.receiptType,
              ...(operationId ? { workflowOperationId: operationId } : {}),
            },
            depth: 0,
            overrideAccess: true,
          })
        } catch (error) {
          payload.logger.warn({
            msg: `Payment receipt sent but receipt history could not be updated for payment ${result.receipt.paymentId}`,
            err: error instanceof Error ? error : new Error(String(error)),
          })
        }

        payload.logger.info({
          msg: 'Client payment receipt sent',
          paymentId: result.receipt.paymentId,
          receiptType: result.receipt.receiptType,
          recipients: delivery.recipients,
          originalRecipients: delivery.originalRecipients,
          redirected: delivery.redirected,
        })
        receipt = { email: result.receipt.receiptEmail, sent: true }
      } catch (error) {
        payload.logger.warn({
          msg: `Payment recorded but client receipt could not be sent for booking ${input.bookingId}`,
          err: error instanceof Error ? error : new Error(String(error)),
        })
        receipt = {
          error: 'Payment was recorded, but the email receipt could not be sent.',
          sent: false,
        }
      }
    }

    return {
      success: true,
      payment: result.payment,
      receipt,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unable to record this payment.',
    }
  }
}

export async function startBookingTerminalPayment(
  input: {
    amountReceived: number
    bookingId: string
    creditApplied?: number
    operationId: string
  },
  req?: AdminPayloadRequest,
) {
  if (!input.bookingId) {
    return { success: false as const, error: 'Booking is required.' }
  }
  if (!input.operationId?.trim()) {
    return { success: false as const, error: 'Payment operation ID is required.' }
  }

  const amountReceived = normalizeMoney(input.amountReceived)
  const creditApplied = normalizeMoney(input.creditApplied)
  if (!Number.isFinite(input.amountReceived) || amountReceived <= 0) {
    return { success: false as const, error: 'Terminal payment amount must be greater than zero.' }
  }
  if (!Number.isFinite(input.creditApplied ?? 0) || creditApplied < 0) {
    return { success: false as const, error: 'Client credit applied must be zero or greater.' }
  }

  const payload = await getAdminPayload(req)
  const booking = await payload.findByID({
    collection: 'bookings',
    id: input.bookingId,
    depth: 4,
    overrideAccess: true,
  })
  const clientId = getRelationshipId(booking.relatedClient)
  const client = typeof booking.relatedClient === 'object' ? (booking.relatedClient as PopulatedClient) : null
  if (!clientId || !client) {
    return { success: false as const, error: 'Select or register the client before collecting payment.' }
  }
  const receiptEmail = resolveClientReceiptEmail(client)
  if (!receiptEmail && !client.disableClientEmails) {
    return { success: false as const, error: 'The client must have an email address for the payment receipt.' }
  }

  const referral = await resolveReferral(payload, client)
  const testType =
    mapTestTypeValue(booking.scheduledTestType) ?? getCalcomBookingTestType(booking) ?? getPreferredTestType(referral)
  const amountDue = normalizeMoney(testType?.price ?? booking.payment?.amountDue)
  if (amountDue <= 0) {
    return { success: false as const, error: "Today's test does not have a valid payment amount." }
  }

  const existingAmountPaid = Math.min(normalizeMoney(booking.payment?.amountPaid), amountDue)
  const bookingBalanceDue = Math.max(0, normalizeMoney(amountDue - existingAmountPaid))

  return startGuidedTerminalPayment({
    amount: amountReceived,
    bookingAmountDue: amountDue,
    bookingBalanceDue,
    bookingId: input.bookingId,
    clientId,
    creditAmount: creditApplied,
    operationId: input.operationId.trim(),
    payload,
    receiptEmail,
  })
}

export async function cancelBookingTerminalPayment(input: { paymentId: string }, req?: AdminPayloadRequest) {
  if (!input.paymentId?.trim()) {
    return { success: false as const, error: 'Terminal payment is required.' }
  }

  const payload = await getAdminPayload(req)
  return cancelGuidedTerminalPayment({
    paymentId: input.paymentId.trim(),
    payload,
  })
}

export async function getBookingTerminalPaymentStatus(
  input: { bookingId?: string; paymentId?: string },
  req?: AdminPayloadRequest,
) {
  if (!input.bookingId && !input.paymentId) {
    throw new Error('Booking ID or payment ID is required.')
  }

  const payload = await getAdminPayload(req)
  return getGuidedTerminalPaymentStatus({
    bookingId: input.bookingId,
    paymentId: input.paymentId,
    payload,
  })
}

export async function undoBookingPayment(
  input: { bookingId: string; operationId?: string },
  req?: AdminPayloadRequest,
) {
  if (!input.bookingId) {
    return { success: false, error: 'Booking is required.' }
  }

  const operationId = input.operationId?.trim() || null
  const payload = await getAdminPayload(req)

  try {
    const result = await withPayloadTransaction(payload, async (req) => {
      const booking = await payload.findByID({
        collection: 'bookings',
        id: input.bookingId,
        depth: 0,
        overrideAccess: true,
        req,
      })
      if (booking.sampleCollection?.status === 'collected') {
        throw new Error('This payment cannot be undone after the sample has been collected.')
      }

      if (
        operationId &&
        booking.payment?.workflowOperationId === operationId &&
        booking.payment.workflowOperationType === 'undo-payment'
      ) {
        return {
          amountRemovedFromBooking: 0,
          payment: booking.payment,
          duplicate: true,
        }
      }

      const clientId = getRelationshipId(booking.relatedClient)
      if (!clientId) {
        throw new Error('Unable to identify the client for this payment.')
      }

      const paymentResult = await payload.find({
        collection: 'payments',
        where: {
          and: [
            { relatedBooking: { equals: input.bookingId } },
            { source: { in: ['guided-workflow', 'credit-application'] } },
            { status: { equals: 'posted' } },
          ],
        },
        depth: 0,
        limit: 1000,
        sort: '-createdAt',
        overrideAccess: true,
        req,
      })
      if (paymentResult.docs.length === 0) {
        throw new Error('No recorded guided payment is available to undo.')
      }

      const reversed = await reversePostedPayments({
        payload,
        clientId,
        payments: paymentResult.docs,
        reason: 'Guided payment undone before sample collection',
        req,
      })
      const amountRemovedFromBooking = paymentResult.docs.reduce(
        (total, payment) => normalizeMoney(total + normalizeMoney(payment.reservedForBookingAmount)),
        0,
      )
      const existingPayment = booking.payment || {}
      const amountDue = normalizeMoney(existingPayment.amountDue)
      const nextAmountPaid = Math.max(
        0,
        normalizeMoney(normalizeMoney(existingPayment.amountPaid) - amountRemovedFromBooking),
      )
      const balanceDue = Math.max(0, normalizeMoney(amountDue - nextAmountPaid))

      const updatedBooking = await payload.update({
        collection: 'bookings',
        id: input.bookingId,
        data: {
          payment: {
            ...existingPayment,
            amountDue,
            amountPaid: nextAmountPaid,
            status: balanceDue <= 0 ? 'paid' : nextAmountPaid > 0 ? 'partial' : 'unpaid',
            method: nextAmountPaid > 0 ? existingPayment.method || 'not-paid' : 'not-paid',
            collectedAt: nextAmountPaid > 0 ? existingPayment.collectedAt : null,
            ...(operationId
              ? {
                  workflowOperationId: operationId,
                  workflowOperationType: 'undo-payment' as const,
                }
              : {}),
          },
        },
        depth: 0,
        overrideAccess: true,
        req,
      })

      return {
        ...reversed,
        amountRemovedFromBooking,
        payment: updatedBooking.payment,
      }
    })

    revalidateBookingViews()
    return { success: true, ...result }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unable to undo this payment.',
    }
  }
}

export async function refreshBookingClientContext(bookingId: string, req?: AdminPayloadRequest) {
  const payload = await getAdminPayload(req)
  const booking = await payload.findByID({
    collection: 'bookings',
    id: bookingId,
    depth: 2,
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
