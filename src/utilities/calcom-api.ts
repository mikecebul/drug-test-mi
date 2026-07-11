const CALCOM_API_BASE_URL = 'https://api.cal.com/v2'

function getCalcomApiKey() {
  return process.env.CAL_API_KEY || process.env.CALCOM_API_KEY || null
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
