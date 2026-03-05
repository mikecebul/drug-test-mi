export type MailpitRecipient = {
  Name?: string
  Address: string
}

export type MailpitMessageSummary = {
  ID: string
  Subject: string
  Created: string
  To: MailpitRecipient[]
  Attachments?: number
}

export type MailpitMessageDetail = {
  ID: string
  Subject: string
  Date?: string
  To: MailpitRecipient[]
  Attachments?: Array<{
    FileName?: string
    PartID?: string
    Size?: number
    ContentType?: string
  }>
}

export type FindMailpitMessagesCriteria = {
  apiBase: string
  createdAfter: Date
  to: string | string[]
  subject: string | RegExp
  requireAttachment?: 'none' | 'some'
  timeoutMs?: number
  pollMs?: number
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function hasRecipient(recipients: MailpitRecipient[] | undefined, expectedEmails: string[]) {
  const normalized = new Set((recipients || []).map((recipient) => normalizeEmail(recipient.Address)))
  return expectedEmails.every((email) => normalized.has(normalizeEmail(email)))
}

function subjectMatches(subject: string, expected: string | RegExp) {
  if (expected instanceof RegExp) {
    return expected.test(subject)
  }
  return subject === expected
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Mailpit API request failed (${response.status}): ${url}`)
  }
  return (await response.json()) as T
}

async function listMessages(apiBase: string): Promise<MailpitMessageSummary[]> {
  const data = await fetchJson<{ messages?: MailpitMessageSummary[] }>(`${apiBase}/messages`)
  return data.messages || []
}

async function getMessage(apiBase: string, id: string): Promise<MailpitMessageDetail> {
  return fetchJson<MailpitMessageDetail>(`${apiBase}/message/${id}`)
}

export async function ensureMailpitReachable(apiBase: string): Promise<void> {
  await listMessages(apiBase)
}

export async function findMailpitMessages(criteria: FindMailpitMessagesCriteria): Promise<MailpitMessageDetail[]> {
  const {
    apiBase,
    createdAfter,
    to,
    subject,
    requireAttachment,
    timeoutMs = 30_000,
    pollMs = 1_000,
  } = criteria

  const expectedEmails = Array.isArray(to) ? to : [to]
  const start = Date.now()
  let lastError: Error | null = null

  while (Date.now() - start <= timeoutMs) {
    try {
      const summaries = await listMessages(apiBase)
      const candidates = summaries.filter((message) => {
        const createdAt = new Date(message.Created)
        if (Number.isNaN(createdAt.getTime()) || createdAt < createdAfter) {
          return false
        }

        if (!subjectMatches(message.Subject, subject)) {
          return false
        }

        return hasRecipient(message.To, expectedEmails)
      })

      if (candidates.length > 0) {
        const detailedMessages: MailpitMessageDetail[] = []
        for (const candidate of candidates) {
          const detail = await getMessage(apiBase, candidate.ID)

          if (requireAttachment === 'none' && (detail.Attachments?.length || 0) > 0) {
            continue
          }

          if (requireAttachment === 'some' && (detail.Attachments?.length || 0) < 1) {
            continue
          }

          detailedMessages.push(detail)
        }

        if (detailedMessages.length > 0) {
          return detailedMessages
        }
      }

      await new Promise((resolve) => setTimeout(resolve, pollMs))
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      await new Promise((resolve) => setTimeout(resolve, pollMs))
    }
  }

  if (lastError) {
    throw new Error(`Failed while polling Mailpit: ${lastError.message}`)
  }

  throw new Error(
    `No Mailpit message found for recipient(s) [${expectedEmails.join(', ')}] and subject ${String(subject)} after ${timeoutMs}ms`,
  )
}
