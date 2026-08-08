import { sdk } from '@/lib/payload-sdk'

import type {
  cancelAndRefundGuidedBooking,
  cancelBookingTerminalPayment,
  cancelGuidedBooking,
  createWalkInBooking,
  ensureClientRedwoodProvisioning,
  getBookingTerminalPaymentStatus,
  getActiveCollectionTestTypes,
  getClientOutstandingPaymentBalances,
  getClientReferralProfile,
  getClientRedwoodProvisioningStatus,
  getTodaysCollectionBookings,
  recordBookingPayment,
  refreshBookingClientContext,
  setBookingScheduledTestType,
  startBookingTerminalPayment,
  undoBookingPayment,
} from './actions'

const API_PATH = '/guided-workflow'
const READ_TIMEOUT_MS = 30_000
const COMMAND_TIMEOUT_MS = 20_000

export type GuidedBooking = Awaited<ReturnType<typeof getTodaysCollectionBookings>>[number]
export type GuidedTestType = Awaited<ReturnType<typeof getActiveCollectionTestTypes>>[number]
export type GuidedReferralProfile = Awaited<ReturnType<typeof getClientReferralProfile>>
export type GuidedRedwoodStatus = Awaited<ReturnType<typeof getClientRedwoodProvisioningStatus>>
export type GuidedOutstandingBalance = Awaited<ReturnType<typeof getClientOutstandingPaymentBalances>>[number]
export type GuidedBookingContext = Awaited<ReturnType<typeof refreshBookingClientContext>>
export type GuidedScheduleActionResult =
  | Awaited<ReturnType<typeof cancelGuidedBooking>>
  | Awaited<ReturnType<typeof cancelAndRefundGuidedBooking>>
export type GuidedPaymentResult = Awaited<ReturnType<typeof recordBookingPayment>>
export type GuidedTerminalPaymentResult = Awaited<ReturnType<typeof startBookingTerminalPayment>>
export type GuidedTerminalPaymentCancelResult = Awaited<ReturnType<typeof cancelBookingTerminalPayment>>
export type GuidedTerminalPaymentStatus = Awaited<ReturnType<typeof getBookingTerminalPaymentStatus>>
export type GuidedUndoPaymentResult = Awaited<ReturnType<typeof undoBookingPayment>>

export class GuidedWorkflowTimeoutError extends Error {
  constructor() {
    super('This is taking longer than expected. Check the current status, then try again.')
    this.name = 'GuidedWorkflowTimeoutError'
  }
}

function createRequestSignal(parentSignal: AbortSignal | undefined, timeoutMs: number) {
  const controller = new AbortController()
  let didTimeout = false

  const abortFromParent = () => {
    controller.abort(parentSignal?.reason)
  }

  if (parentSignal?.aborted) {
    abortFromParent()
  } else {
    parentSignal?.addEventListener('abort', abortFromParent, { once: true })
  }

  const timeoutId = window.setTimeout(() => {
    didTimeout = true
    controller.abort()
  }, timeoutMs)

  return {
    cleanup() {
      window.clearTimeout(timeoutId)
      parentSignal?.removeEventListener('abort', abortFromParent)
    },
    didTimeout: () => didTimeout,
    signal: controller.signal,
  }
}

async function requestJSON<T>(options: {
  json?: unknown
  method: 'GET' | 'POST'
  path: string
  signal?: AbortSignal
  timeoutMs?: number
}): Promise<T> {
  const requestSignal = createRequestSignal(
    options.signal,
    options.timeoutMs ?? (options.method === 'GET' ? READ_TIMEOUT_MS : COMMAND_TIMEOUT_MS),
  )

  try {
    const response = await sdk.request({
      method: options.method,
      path: options.path,
      json: options.json,
      init: {
        signal: requestSignal.signal,
      },
    })

    return (await response.json()) as T
  } catch (error) {
    if (requestSignal.didTimeout()) {
      throw new GuidedWorkflowTimeoutError()
    }
    throw error
  } finally {
    requestSignal.cleanup()
  }
}

function getPath(resource: string, params: Record<string, string | undefined> = {}) {
  const search = new URLSearchParams({ resource })
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value)
  }
  return `${API_PATH}?${search.toString()}`
}

function command<T>(operation: string, input: Record<string, unknown>, signal?: AbortSignal) {
  return requestJSON<T>({
    method: 'POST',
    path: API_PATH,
    json: { operation, input },
    signal,
  })
}

export const guidedWorkflowApi = {
  cancelBooking(input: { action: 'cancel' | 'cancel-refund'; bookingId: string }, signal?: AbortSignal) {
    return command<GuidedScheduleActionResult>(
      input.action === 'cancel-refund' ? 'cancel-refund-booking' : 'cancel-booking',
      { bookingId: input.bookingId },
      signal,
    )
  },

  cancelTerminalPayment(input: { paymentId: string }, signal?: AbortSignal) {
    return command<GuidedTerminalPaymentCancelResult>('cancel-terminal-payment', input, signal)
  },

  createWalkIn(input: { clientId: string }, signal?: AbortSignal) {
    return command<Awaited<ReturnType<typeof createWalkInBooking>>>('create-walk-in', input, signal)
  },

  ensureRedwood(input: { clientId: string; testTypeValue: string }, signal?: AbortSignal) {
    return command<Awaited<ReturnType<typeof ensureClientRedwoodProvisioning>>>('ensure-redwood', input, signal)
  },

  getBookingContext(bookingId: string, signal?: AbortSignal) {
    return requestJSON<GuidedBookingContext>({
      method: 'GET',
      path: getPath('booking-context', { bookingId }),
      signal,
    })
  },

  getOutstandingBalances(clientId: string, signal?: AbortSignal) {
    return requestJSON<GuidedOutstandingBalance[]>({
      method: 'GET',
      path: getPath('outstanding-balances', { clientId }),
      signal,
    })
  },

  getRedwoodStatus(clientId: string, testTypeValue: string, signal?: AbortSignal) {
    return requestJSON<GuidedRedwoodStatus>({
      method: 'GET',
      path: getPath('redwood-status', { clientId, testTypeValue }),
      signal,
    })
  },

  getReferralProfile(clientId: string, signal?: AbortSignal) {
    return requestJSON<GuidedReferralProfile>({
      method: 'GET',
      path: getPath('referral-profile', { clientId }),
      signal,
    })
  },

  getTestTypes(signal?: AbortSignal) {
    return requestJSON<GuidedTestType[]>({
      method: 'GET',
      path: getPath('test-types'),
      signal,
    })
  },

  getTerminalPaymentStatus(
    input: { bookingId?: string; paymentId?: string },
    signal?: AbortSignal,
  ) {
    return requestJSON<GuidedTerminalPaymentStatus>({
      method: 'GET',
      path: getPath('terminal-payment-status', input),
      signal,
    })
  },

  getTodayBookings(signal?: AbortSignal) {
    return requestJSON<GuidedBooking[]>({
      method: 'GET',
      path: getPath('today-bookings'),
      signal,
    })
  },

  linkClient(input: { bookingId: string; clientId: string }, signal?: AbortSignal) {
    return command<{ success: true }>('link-client', input, signal)
  },

  recordPayment(
    input: {
      amountReceived: number
      bookingId: string
      creditApplied?: number
      method: 'card' | 'cash'
      notes?: string
      operationId: string
      sendReceipt?: boolean
    },
    signal?: AbortSignal,
  ) {
    return command<GuidedPaymentResult>('record-payment', input, signal)
  },

  setTestType(input: { bookingId: string; testTypeId: string }, signal?: AbortSignal) {
    return command<Awaited<ReturnType<typeof setBookingScheduledTestType>>>('set-test-type', input, signal)
  },

  startTerminalPayment(
    input: {
      amountReceived: number
      bookingId: string
      creditApplied?: number
      operationId: string
    },
    signal?: AbortSignal,
  ) {
    return command<GuidedTerminalPaymentResult>('start-terminal-payment', input, signal)
  },

  undoPayment(input: { bookingId: string; operationId: string }, signal?: AbortSignal) {
    return command<GuidedUndoPaymentResult>('undo-payment', input, signal)
  },
}
