import config from '@payload-config'
import { NextResponse, type NextRequest } from 'next/server'
import { getPayload, type PayloadRequest } from 'payload'
import { z } from 'zod'

import {
  cancelAndRefundGuidedBooking,
  cancelGuidedBooking,
  createWalkInBooking,
  ensureClientRedwoodProvisioning,
  getBookingTerminalPaymentStatus,
  getActiveCollectionTestTypes,
  getClientOutstandingPaymentBalances,
  getClientReferralProfile,
  getClientRedwoodProvisioningStatus,
  getTodaysCollectionBookings,
  linkBookingToClient,
  recordBookingPayment,
  refreshBookingClientContext,
  setBookingScheduledTestType,
  startBookingTerminalPayment,
  undoBookingPayment,
} from '@/views/DrugTestWizard/workflows/complete-workflow/actions'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const requiredId = z.string().trim().min(1)
const operationId = z.string().trim().min(8).max(200)

const commandSchema = z.discriminatedUnion('operation', [
  z.object({
    operation: z.literal('cancel-booking'),
    input: z.object({ bookingId: requiredId }),
  }),
  z.object({
    operation: z.literal('cancel-refund-booking'),
    input: z.object({ bookingId: requiredId }),
  }),
  z.object({
    operation: z.literal('create-walk-in'),
    input: z.object({ clientId: requiredId }),
  }),
  z.object({
    operation: z.literal('ensure-redwood'),
    input: z.object({ clientId: requiredId, testTypeValue: requiredId }),
  }),
  z.object({
    operation: z.literal('link-client'),
    input: z.object({ bookingId: requiredId, clientId: requiredId }),
  }),
  z.object({
    operation: z.literal('record-payment'),
    input: z.object({
      bookingId: requiredId,
      amountReceived: z.number().finite().nonnegative(),
      creditApplied: z.number().finite().nonnegative().optional(),
      method: z.enum(['cash', 'card']),
      notes: z.string().optional(),
      operationId,
      sendReceipt: z.boolean().optional(),
    }),
  }),
  z.object({
    operation: z.literal('start-terminal-payment'),
    input: z.object({
      bookingId: requiredId,
      amountReceived: z.number().finite().positive(),
      creditApplied: z.number().finite().nonnegative().optional(),
      operationId,
    }),
  }),
  z.object({
    operation: z.literal('set-test-type'),
    input: z.object({ bookingId: requiredId, testTypeId: requiredId }),
  }),
  z.object({
    operation: z.literal('undo-payment'),
    input: z.object({ bookingId: requiredId, operationId }),
  }),
])

function json(data: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers)
  headers.set('Cache-Control', 'no-store')
  return NextResponse.json(data, { ...init, headers })
}

async function authenticateAdmin(request: NextRequest) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: request.headers })

  if (!user) {
    return { response: json({ message: 'Authentication required.' }, { status: 401 }) }
  }

  if (user.collection !== 'admins') {
    return { response: json({ message: 'Admin account required.' }, { status: 403 }) }
  }

  return {
    adminRequest: {
      payload,
      user,
    } satisfies Pick<PayloadRequest, 'payload' | 'user'>,
  }
}

function requiredSearchParam(request: NextRequest, name: string) {
  const value = request.nextUrl.searchParams.get(name)?.trim()
  if (!value) {
    throw new Error(`${name} is required.`)
  }
  return value
}

export async function GET(request: NextRequest) {
  const auth = await authenticateAdmin(request)
  if (auth.response) return auth.response

  try {
    const resource = requiredSearchParam(request, 'resource')
    const adminRequest = auth.adminRequest

    switch (resource) {
      case 'booking-context':
        return json(await refreshBookingClientContext(requiredSearchParam(request, 'bookingId'), adminRequest))
      case 'outstanding-balances':
        return json(await getClientOutstandingPaymentBalances(requiredSearchParam(request, 'clientId'), adminRequest))
      case 'redwood-status':
        return json(
          await getClientRedwoodProvisioningStatus(
            requiredSearchParam(request, 'clientId'),
            requiredSearchParam(request, 'testTypeValue'),
            adminRequest,
          ),
        )
      case 'referral-profile':
        return json(await getClientReferralProfile(requiredSearchParam(request, 'clientId'), adminRequest))
      case 'test-types':
        return json(await getActiveCollectionTestTypes())
      case 'terminal-payment-status':
        return json(
          await getBookingTerminalPaymentStatus(
            {
              bookingId: request.nextUrl.searchParams.get('bookingId')?.trim() || undefined,
              paymentId: request.nextUrl.searchParams.get('paymentId')?.trim() || undefined,
            },
            adminRequest,
          ),
        )
      case 'today-bookings':
        return json(await getTodaysCollectionBookings(adminRequest))
      default:
        return json({ message: 'Unknown guided workflow resource.' }, { status: 404 })
    }
  } catch (error) {
    return json(
      {
        message: error instanceof Error ? error.message : 'Unable to load guided workflow data.',
      },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  const auth = await authenticateAdmin(request)
  if (auth.response) return auth.response

  try {
    const command = commandSchema.parse(await request.json())
    const adminRequest = auth.adminRequest

    switch (command.operation) {
      case 'cancel-booking':
        return json(await cancelGuidedBooking(command.input, adminRequest))
      case 'cancel-refund-booking':
        return json(await cancelAndRefundGuidedBooking(command.input, adminRequest))
      case 'create-walk-in':
        return json(await createWalkInBooking(command.input, adminRequest))
      case 'ensure-redwood':
        return json(
          await ensureClientRedwoodProvisioning(command.input.clientId, command.input.testTypeValue, adminRequest),
        )
      case 'link-client':
        await linkBookingToClient(command.input.bookingId, command.input.clientId, adminRequest)
        return json({ success: true })
      case 'record-payment':
        return json(await recordBookingPayment(command.input, adminRequest))
      case 'set-test-type':
        return json(await setBookingScheduledTestType(command.input.bookingId, command.input.testTypeId, adminRequest))
      case 'start-terminal-payment':
        return json(await startBookingTerminalPayment(command.input, adminRequest))
      case 'undo-payment':
        return json(await undoBookingPayment(command.input, adminRequest))
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return json({ message: 'Invalid guided workflow request.', errors: error.issues }, { status: 400 })
    }

    return json(
      {
        message: error instanceof Error ? error.message : 'Unable to complete the guided workflow request.',
      },
      { status: 500 },
    )
  }
}
