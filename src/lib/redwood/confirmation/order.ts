import { createHash } from 'node:crypto'
import type { CollectionAfterChangeHook, Payload, PayloadRequest } from 'payload'
import type { DrugTest } from '@/payload-types'
import { getTestTypeByValue } from '@/config/test-types'
import { allSubstanceOptions } from '@/fields/substanceOptions'
import { readRelationshipId } from '@/collections/Payments/services/applyPayment'
import { APP_TIMEZONE } from '@/lib/date-utils'
import { isNonLiveEmailMode, prefixNonLiveEmailSubject, resolveOutboundNotificationRecipients } from '@/lib/email-safety'
import { normalizeRedwoodAccession } from '@/utilities/extractors/redwoodAccession'

const redwoodAddress = 'clientservices@redwoodtoxicology.com'
const from = 'Mike Cebulski <mike@midrugtest.com>'
const subject = 'Agency 310872 - Confirmation request'
const task = 'send-paid-redwood-confirmation' as const
const dateFormat = new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: APP_TIMEZONE })
const listFormat = new Intl.ListFormat('en-US', { type: 'conjunction' })
const labels = new Map<string, string>(allSubstanceOptions.filter(({ value }) => value !== 'none').map(({ value, label }) => [value, label]))

function readOrder(test: DrugTest) {
  const confirmationFee = test.payment?.confirmationFeeDue ?? 0
  const totalDue = test.payment?.amountDue ?? 0
  if (
    test.redwoodConfirmationSentAt || test.isInconclusive || test.confirmationDocument ||
    test.confirmationDecision !== 'request-confirmation' || getTestTypeByValue(test.testType)?.category !== 'lab' ||
    test.payment?.status !== 'paid' || confirmationFee <= 0 || totalDue < confirmationFee ||
    (test.payment.amountPaid ?? 0) < totalDue
  ) return null

  const accession = normalizeRedwoodAccession(test.accessionNumber)
  const clientId = readRelationshipId(test.relatedClient)
  const collected = new Date(test.collectionDate ?? '')
  if (!accession || !clientId || !Number.isFinite(collected.getTime())) return null

  const completed = new Set(test.confirmationResults?.map(({ substance }) => substance))
  const selected = [...new Set(test.confirmationSubstances)].filter((value) => !completed.has(value))
  if (!selected.length || selected.some((value) => !labels.has(value))) return null

  const collectedDate = dateFormat.format(collected)
  const key = createHash('sha256').update(JSON.stringify([accession, clientId, collectedDate, [...selected].sort()])).digest('hex')
  return { accession, clientId, collectedDate, selected, key }
}

export const queuePaidRedwoodConfirmation: CollectionAfterChangeHook<DrugTest> = async ({ doc, previousDoc, req }) => {
  const order = readOrder(doc)
  if (order && (!previousDoc || readOrder(previousDoc)?.key !== order.key)) {
    await req.payload.jobs.queue({
      task,
      queue: 'redwood',
      input: { testId: doc.id, orderKey: order.key },
      req,
    })
  }
  return doc
}

function substanceName(value: string) {
  if (value === 'alcohol') return 'alcohol'
  if (value === 'etg') return 'EtG (alcohol)'
  if (value === 'fentanyl') return 'fentanyl'
  return labels.get(value) ?? value
}

async function sendRedwoodEmail(payload: Payload, accession: string, text: string): Promise<string | null> {
  const routing = resolveOutboundNotificationRecipients([redwoodAddress])
  const email = { to: routing.recipients, from, subject: prefixNonLiveEmailSubject(subject), text }

  if (process.env.NODE_ENV !== 'production') {
    await payload.sendEmail(email)
    return null
  }

  if (!process.env.RESEND_API_KEY) throw new Error('Resend is not configured for Redwood confirmation requests.')
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `redwood-confirmation/310872/${accession}`,
    },
    body: JSON.stringify(email),
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) throw new Error(`Resend returned HTTP ${response.status} for the Redwood order.`)
  const result = await response.json() as { id?: string }
  if (!result.id) throw new Error('Resend did not return an email ID for the Redwood order.')
  return result.id
}

export async function sendPaidRedwoodConfirmation(req: PayloadRequest, testId: string, orderKey: string, queuedAt: string) {
  const { payload } = req
  const test = await payload.findByID({ collection: 'drug-tests', id: testId, depth: 0, disableErrors: true })
  const order = test ? readOrder(test) : null
  if (!order || order.key !== orderKey) return { status: 'skipped' }
  if (process.env.NODE_ENV === 'production' && isNonLiveEmailMode()) return { status: 'non-live' }

  // Resend retains idempotency keys for 24 hours. Older jobs need operator review.
  if (!(Date.now() - Date.parse(queuedAt) < 23 * 60 * 60 * 1000)) {
    throw new Error('The Redwood order is past its retry window. Verify delivery before ordering again.')
  }
  const client = await payload.findByID({ collection: 'clients', id: order.clientId, depth: 0 })
  const name = [client.firstName, client.lastName].join(' ').replace(/\s+/g, ' ').trim()
  if (!name) throw new Error('The client has no name for the Redwood confirmation request.')
  const substances = listFormat.format(order.selected.map(substanceName))
  const message = [
    'Hello,',
    '',
    `I would like to order a confirmation of ${substances} for ${name}.`,
    '',
    `Accession #: ${order.accession}`,
    `Collected: ${order.collectedDate}`,
    '',
    '',
    'Mike Cebulski',
    'Owner  | MI Drug Test',
    '🌐 midrugtest.com',
    '📞 (231) 373-6341',
    '✉️ mike@midrugtest.com',
  ].join('\n')

  const emailId = await sendRedwoodEmail(payload, order.accession, message)
  await payload.update({
    collection: 'drug-tests', id: testId,
    data: { redwoodConfirmationSentAt: new Date().toISOString(), redwoodConfirmationEmailId: emailId },
    context: { skipTestResultComputation: true, skipClientBalanceSync: true },
  })
  return { status: 'sent' }
}
