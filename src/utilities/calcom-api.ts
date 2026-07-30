const CALCOM_API_BASE_URL = 'https://api.cal.com/v2'

function getCalcomApiKey() {
  return process.env.CAL_API_KEY || process.env.CALCOM_API_KEY || null
}

function getRequiredCalcomApiKey() {
  const apiKey = getCalcomApiKey()
  if (!apiKey) throw new Error('Cal.com API key is not configured.')
  return apiKey
}

async function getErrorMessage(response: Response) {
  const text = await response.text()
  if (!text) return response.statusText

  try {
    const parsed = JSON.parse(text) as { message?: unknown; error?: unknown }
    if (typeof parsed.message === 'string') return parsed.message
    if (typeof parsed.error === 'string') return parsed.error
  } catch {
    return text
  }

  return text
}

async function parseCalcomResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(await getErrorMessage(response))
  }

  const body = (await response.json()) as { data?: T }
  if (body.data === undefined) throw new Error('Cal.com returned an unexpected response.')
  return body.data
}

export type CalcomBookingRecord = {
  id: number
  uid: string
  title: string
  start: string
  end: string
  metadata?: Record<string, unknown> | null
  attendees?: Array<{ email?: string; name?: string; timeZone?: string }>
  hosts?: Array<{ email?: string; id?: number; name?: string; timeZone?: string }>
  eventTypeId?: number
  status?: string
}

type CalcomSchedule = {
  id: number
  isDefault?: boolean
  timeZone?: string
  availability?: Array<{
    days?: Array<number | string>
    endTime?: string
    startTime?: string
  }>
  overrides?: Array<{
    date?: string
    endTime?: string | null
    startTime?: string | null
  }>
  dateOverrides?: Array<{
    date?: string
    endTime?: string | null
    startTime?: string | null
  }>
}

export async function getCalcomSchedule(scheduleId?: number): Promise<CalcomSchedule> {
  const apiKey = getRequiredCalcomApiKey()
  const path = scheduleId ? `/schedules/${scheduleId}` : '/schedules/default'
  const response = await fetch(`${CALCOM_API_BASE_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'cal-api-version': '2024-06-11',
    },
  })
  return parseCalcomResponse<CalcomSchedule>(response)
}

export async function listCalcomBookings(input: {
  afterStart: string
  beforeEnd: string
}): Promise<CalcomBookingRecord[]> {
  const apiKey = getRequiredCalcomApiKey()
  const bookings: CalcomBookingRecord[] = []
  let cursor: string | null = null

  for (let page = 0; page < 20; page += 1) {
    const params = new URLSearchParams({
      afterStart: input.afterStart,
      beforeEnd: input.beforeEnd,
      sortStart: 'asc',
      limit: '100',
    })
    if (cursor) params.set('cursor', cursor)

    const response = await fetch(`${CALCOM_API_BASE_URL}/bookings?${params}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'cal-api-version': '2026-05-01',
      },
    })
    if (!response.ok) throw new Error(await getErrorMessage(response))
    const body = (await response.json()) as {
      data?: CalcomBookingRecord[]
      pagination?: { hasMore?: boolean; nextCursor?: string | null }
    }
    if (!Array.isArray(body.data)) throw new Error('Cal.com returned an unexpected bookings response.')
    bookings.push(...body.data)

    if (!body.pagination?.hasMore) return bookings
    cursor = body.pagination.nextCursor || null
    if (!cursor) throw new Error('Cal.com indicated more booking pages without returning a cursor.')
  }

  throw new Error('Cal.com bookings pagination exceeded the 20-page safety limit.')
}

export async function createCalcomBooking(input: {
  attendee: {
    email: string
    language?: string
    name: string
    timeZone: string
  }
  eventTypeId: number
  metadata: Record<string, string>
  start: string
}): Promise<CalcomBookingRecord> {
  const apiKey = getRequiredCalcomApiKey()
  const response = await fetch(`${CALCOM_API_BASE_URL}/bookings`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'cal-api-version': '2026-02-25',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...input,
      bookingFieldsResponses: {
        title: input.attendee.name,
      },
      allowConflicts: true,
      allowBookingOutOfBounds: true,
      skipBookingLimits: true,
    }),
  })
  return parseCalcomResponse<CalcomBookingRecord>(response)
}

export async function cancelCalcomBooking(input: { bookingUid: string; cancellationReason?: string }) {
  const apiKey = getCalcomApiKey()
  if (!apiKey) {
    return {
      success: false,
      error: 'Cal.com API key is not configured.',
    }
  }

  let response: Response

  try {
    response = await fetch(`${CALCOM_API_BASE_URL}/bookings/${encodeURIComponent(input.bookingUid)}/cancel`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'cal-api-version': '2024-08-13',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cancellationReason: input.cancellationReason || 'Cancelled by admin',
      }),
    })
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Cal.com cancellation request failed.',
    }
  }

  if (!response.ok) {
    return {
      success: false,
      error: await getErrorMessage(response),
    }
  }

  return {
    success: true,
  }
}
