import { createHash } from 'node:crypto'
import type { CollectionAfterChangeHook, Payload, PayloadRequest } from 'payload'
import type { DrugTest } from '@/payload-types'
import { getTestTypeByValue } from '@/config/test-types'
import { allSubstanceOptions } from '@/fields/substanceOptions'
import { readRelationshipId } from '@/collections/Payments/services/applyPayment'
import {
  getConfirmationSubstances,
  getOutstandingConfirmations,
  LAB_CONFIRMATION_FEE,
} from '@/collections/DrugTests/helpers/confirmationPayment'
import { createAdminAlert } from '@/lib/admin-alerts'
import { APP_TIMEZONE } from '@/lib/date-utils'
import { isNonLiveEmailMode, prefixNonLiveEmailSubject, resolveOutboundNotificationRecipients } from '@/lib/email-safety'
import { normalizeRedwoodAccession } from '@/utilities/extractors/redwoodAccession'

const redwoodAddress = 'clientservices@redwoodtoxicology.com'
const from = 'Mike Cebulski <mike@midrugtest.com>'
const accountNumber = '310872'
const subject = `Agency ${accountNumber} - Confirmation request`
const task = 'send-paid-redwood-confirmation' as const
const dateFormat = new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: APP_TIMEZONE })
const listFormat = new Intl.ListFormat('en-US', { type: 'conjunction' })
const labels = new Map<string, string>(allSubstanceOptions.filter(({ value }) => value !== 'none').map(({ value, label }) => [value, label]))

function readPaidOrder(test: DrugTest) {
  const confirmationFee = test.payment?.confirmationFeeDue ?? 0
  const totalDue = test.payment?.amountDue ?? 0
  if (
    test.redwoodConfirmationSentAt || test.redwoodConfirmationEmailOnHold || test.isInconclusive || test.confirmationDocument ||
    test.confirmationDecision !== 'request-confirmation' || getTestTypeByValue(test.testType)?.category !== 'lab' ||
    test.payment?.status !== 'paid' || confirmationFee <= 0 || totalDue < confirmationFee ||
    (test.payment.amountPaid ?? 0) < totalDue
  ) return null

  const clientId = readRelationshipId(test.relatedClient)
  const collected = new Date(test.collectionDate ?? '')
  if (!clientId || !Number.isFinite(collected.getTime())) return null

  const input = new Set(test.confirmationSubstances)
  const selected = getConfirmationSubstances([...input])
  const outstanding = getOutstandingConfirmations(selected, test.confirmationResults)
  if (selected.length !== input.size || !outstanding.length || confirmationFee < LAB_CONFIRMATION_FEE * selected.length) return null

  return { clientId, collectedDate: dateFormat.format(collected), selected: outstanding }
}

function readOrder(test: DrugTest) {
  const order = readPaidOrder(test)
  const accession = normalizeRedwoodAccession(test.accessionNumber)
  if (!order || !accession || test.redwoodReportAccountNumber !== accountNumber) return null
  const { clientId, collectedDate, selected } = order
  const key = createHash('sha256').update(JSON.stringify([accession, clientId, collectedDate, [...selected].sort()])).digest('hex')
  return { ...order, accession, key }
}

function getPaidOrderBlocker(test: DrugTest) {
  if (!readPaidOrder(test)) return null
  if (!normalizeRedwoodAccession(test.accessionNumber)) return 'missing-accession'
  if (test.redwoodReportAccountNumber !== accountNumber) return 'unverified-account'
  return null
}

export const queuePaidRedwoodConfirmation: CollectionAfterChangeHook<DrugTest> = async ({ doc, previousDoc, req }) => {
  const order = readOrder(doc)
  if (order) {
    if (previousDoc && readOrder(previousDoc)?.key === order.key) return doc
    await req.payload.jobs.queue({
      task,
      queue: 'redwood',
      input: { testId: doc.id, orderKey: order.key },
      req,
    })
    return doc
  }

  const blocker = getPaidOrderBlocker(doc)
  if (blocker && (!previousDoc || blocker !== getPaidOrderBlocker(previousDoc))) {
    const missingAccession = blocker === 'missing-accession'
    await createAdminAlert(req.payload, {
      severity: 'high',
      alertType: missingAccession ? 'document-missing' : 'data-integrity',
      title: missingAccession
        ? 'Paid Redwood confirmation needs an accession number'
        : 'Paid Redwood confirmation needs account review',
      message: missingAccession
        ? 'Verify the donor and collection date against the attached screening report.'
        : `Verify the report account before ordering. Automatic orders are enabled for account ${accountNumber}.`,
      context: { drugTestId: doc.id },
    }, req)
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
      'Idempotency-Key': `redwood-confirmation/${accountNumber}/${accession}`,
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
