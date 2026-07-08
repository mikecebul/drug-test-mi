export type CalcomBookingActionLinks = {
  cancelHref: string | null
  rescheduleHref: string | null
}

const CALCOM_BASE_URL = 'https://cal.com'

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

function normalizeCalcomUrl(value: unknown) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  if (trimmed.startsWith('/')) return `${CALCOM_BASE_URL}${trimmed}`
  return null
}

function getFirstUrl(sources: Array<Record<string, unknown> | null>, keys: string[]) {
  for (const source of sources) {
    if (!source) continue

    for (const key of keys) {
      const url = normalizeCalcomUrl(source[key])
      if (url) return url
    }
  }

  return null
}

export function getCalcomBookingActionLinks(input: {
  calcomBookingId?: string | null
  webhookData?: unknown
}): CalcomBookingActionLinks {
  const webhookData = asRecord(input.webhookData)
  const payload = asRecord(webhookData?.payload)
  const sources = [payload, webhookData]
  const encodedBookingUid = input.calcomBookingId ? encodeURIComponent(input.calcomBookingId) : null

  return {
    cancelHref:
      getFirstUrl(sources, ['cancelUrl', 'cancelURL', 'cancelLink', 'cancellationUrl', 'cancellationLink']) ??
      (encodedBookingUid ? `${CALCOM_BASE_URL}/booking/${encodedBookingUid}?cancel=true` : null),
    rescheduleHref:
      getFirstUrl(sources, [
        'rescheduleUrl',
        'rescheduleURL',
        'rescheduleLink',
        'reschedulingUrl',
        'reschedulingLink',
      ]) ?? (encodedBookingUid ? `${CALCOM_BASE_URL}/reschedule/${encodedBookingUid}` : null),
  }
}
