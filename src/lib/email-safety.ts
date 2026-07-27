const DEFAULT_TEST_EMAIL = 'mike@midrugtest.com'

function parseEmailList(value?: string): string[] {
  return (value || '')
    .split(/[,\s;]+/)
    .map((email) => email.trim())
    .filter(Boolean)
}

function uniqueEmails(emails: string[]): string[] {
  const seen = new Set<string>()
  const unique: string[] = []

  for (const email of emails) {
    const normalized = email.trim()
    if (!normalized) continue

    const key = normalized.toLowerCase()
    if (seen.has(key)) continue

    seen.add(key)
    unique.push(normalized)
  }

  return unique
}

export function isNonLiveEmailMode(): boolean {
  return process.env.EMAIL_TEST_MODE === 'true' || process.env.NEXT_PUBLIC_IS_LIVE === 'false'
}

export function getNonLiveEmailBlocklist(): string[] {
  return uniqueEmails(['tom@midrugtest.com', ...parseEmailList(process.env.NON_LIVE_EMAIL_BLOCKLIST)])
}

export function getEmailTestAddress(): string {
  const configuredAddress = process.env.EMAIL_TEST_ADDRESS?.trim() || DEFAULT_TEST_EMAIL
  const blocked = new Set(getNonLiveEmailBlocklist().map((email) => email.toLowerCase()))

  return blocked.has(configuredAddress.toLowerCase()) ? DEFAULT_TEST_EMAIL : configuredAddress
}

export function filterNonLiveBlockedRecipients(recipients: string[]): string[] {
  const uniqueRecipients = uniqueEmails(recipients)
  if (!isNonLiveEmailMode()) return uniqueRecipients

  const blocked = new Set(getNonLiveEmailBlocklist().map((email) => email.toLowerCase()))
  return uniqueRecipients.filter((email) => !blocked.has(email.toLowerCase()))
}

export function resolveOutboundNotificationRecipients(recipients: string[]): {
  originalRecipients: string[]
  redirected: boolean
  recipients: string[]
  testAddress: string
} {
  const originalRecipients = filterNonLiveBlockedRecipients(recipients)
  const testAddress = getEmailTestAddress()

  if (!isNonLiveEmailMode()) {
    return {
      originalRecipients,
      redirected: false,
      recipients: originalRecipients,
      testAddress,
    }
  }

  return {
    originalRecipients,
    redirected: true,
    recipients: [testAddress],
    testAddress,
  }
}

export function prefixNonLiveEmailSubject(subject: string): string {
  return isNonLiveEmailMode() ? `[TEST MODE] ${subject}` : subject
}
