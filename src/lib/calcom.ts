/**
 * Cal.com API Integration
 * Handles booking cancellation and reschedule operations
 */

interface CalcomApiError {
  message: string
  code?: string
  status: number
}

interface CancelBookingResponse {
  message: string
  bookingUid: string
}

interface RescheduleUrlOptions {
  bookingUid: string
  calcomUsername: string
  eventSlug: string
}

/**
 * Cancel a Cal.com booking
 * For recurring bookings, this cancels ALL recurrences
 *
 * @param bookingUid - The Cal.com booking UID
 * @param cancellationReason - Reason for cancellation
 * @returns Promise with cancellation result
 */
export async function cancelCalcomBooking(
  bookingUid: string,
  cancellationReason: string,
): Promise<CancelBookingResponse> {
  const apiKey = process.env.CALCOM_API_KEY

  if (!apiKey) {
    throw new Error('CALCOM_API_KEY is not configured')
  }

  try {
    const response = await fetch(
      `https://api.cal.com/v2/bookings/${bookingUid}/cancel`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cancellationReason,
        }),
      },
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      const error: CalcomApiError = {
        message: errorData.message || 'Failed to cancel booking',
        code: errorData.code,
        status: response.status,
      }
      throw error
    }

    const data = await response.json()

    console.log(`✓ Cancelled Cal.com booking: ${bookingUid}`)

    return {
      message: data.message || 'Booking cancelled successfully',
      bookingUid,
    }
  } catch (error) {
    console.error('Error cancelling Cal.com booking:', error)
    throw error
  }
}

/**
 * Generate a reschedule URL for embedding or redirecting
 * Cal.com supports rescheduling via embed with rescheduleUid
 *
 * @param options - Reschedule configuration
 * @returns Reschedule URL for Cal.com embed
 */
export function getRescheduleUrl(options: RescheduleUrlOptions): string {
  const { bookingUid, calcomUsername, eventSlug } = options

  // Cal.com reschedule URL format
  return `https://cal.com/${calcomUsername}/${eventSlug}?rescheduleUid=${bookingUid}`
}

/**
 * Generate Cal.com embed configuration for rescheduling
 * Use this with Cal.com's embed script
 *
 * @param bookingUid - The booking to reschedule
 * @returns Cal.com embed configuration object
 */
export function getRescheduleEmbedConfig(bookingUid: string) {
  return {
    rescheduleUid: bookingUid,
    'flag.coep': 'true',
  }
}

/**
 * Extract phone number from Cal.com webhook payload
 * Tries multiple possible locations in the payload
 *
 * @param payload - Cal.com webhook payload
 * @returns Phone number if found, null otherwise
 */
export function extractPhoneFromCalcomWebhook(payload: any): string | null {
  // Try responses.phone first
  if (payload.responses?.phone?.value) {
    return payload.responses.phone.value
  }

  // Try responses.guests[].email (sometimes phone is in metadata)
  if (payload.responses?.guests) {
    for (const guest of payload.responses.guests) {
      if (guest.phone) {
        return guest.phone
      }
    }
  }

  // Try customInputs
  if (payload.customInputs) {
    const phoneInput = Object.values(payload.customInputs).find(
      (input: any) => input.label?.toLowerCase().includes('phone'),
    ) as any

    if (phoneInput?.value) {
      return phoneInput.value
    }
  }

  // Try metadata
  if (payload.metadata?.phone) {
    return payload.metadata.phone
  }

  return null
}

/**
 * Detect if a Cal.com booking is part of a recurring series
 *
 * @param payload - Cal.com webhook payload
 * @returns Object with isRecurring flag and recurringGroupId
 */
export function detectRecurringBooking(payload: any): {
  isRecurring: boolean
  recurringGroupId: string | null
} {
  // Check for recurring event ID
  const recurringEventId = payload.recurringEventId || payload.recurring?.id || null

  // Check if event type has recurrence rules
  const hasRecurrence = Boolean(
    payload.recurrence ||
    payload.eventType?.recurring ||
    recurringEventId,
  )

  return {
    isRecurring: hasRecurrence,
    recurringGroupId: recurringEventId,
  }
}

/**
 * Normalize phone number to a consistent format
 * Removes non-digit characters except + for international numbers
 *
 * @param phone - Raw phone number
 * @returns Normalized phone number
 */
export function normalizePhoneNumber(phone: string): string {
  // Remove all non-digit characters except leading +
  const cleaned = phone.replace(/[^\d+]/g, '')

  // If it starts with +, keep it, otherwise remove any + in the middle
  if (cleaned.startsWith('+')) {
    return cleaned
  }

  return cleaned.replace(/\+/g, '')
}

/**
 * Compare two phone numbers for equality
 * Handles different formatting styles
 *
 * @param phone1 - First phone number
 * @param phone2 - Second phone number
 * @returns True if phones are the same
 */
export function phoneNumbersMatch(phone1: string, phone2: string): boolean {
  const normalized1 = normalizePhoneNumber(phone1)
  const normalized2 = normalizePhoneNumber(phone2)

  return normalized1 === normalized2
}
