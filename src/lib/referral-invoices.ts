import Stripe from 'stripe'
import type { Payload } from 'payload'
import type { Client, Court, DrugTest, Employer, ReferralInvoice } from '@/payload-types'
import { getTestTypeLabel } from '@/config/test-types'
import { buildReferralInvoiceEmail, REFERRAL_CHECK_FOOTER } from '@/emails/payments/ReferralInvoiceEmail'
import { prefixNonLiveEmailSubject, resolveOutboundNotificationRecipients } from '@/lib/email-safety'
import { billingPeriodEnd, collectionDateInDetroit, currentBillingMonth } from '@/lib/referral-invoices/date'
import { settleReferralInvoice } from '@/lib/referral-invoices/settle'
export { currentBillingMonth, previousBillingMonth } from '@/lib/referral-invoices/date'

export type ReferralCollection = 'courts' | 'employers'
type Referral = Court | Employer
type InvoiceItem = NonNullable<ReferralInvoice['items']>[number]

const PAGE_SIZE = 100
const STRIPE_ITEM_LIMIT = 250

function idOf(value: unknown): string | null {
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (value && typeof value === 'object' && 'id' in value) return idOf(value.id)
  return null
}

async function findAll<T>(fetchPage: (page: number) => Promise<{ docs: T[]; hasNextPage: boolean }>) {
  const docs: T[] = []
  for (let page = 1; ; page += 1) {
    const result = await fetchPage(page)
    docs.push(...result.docs)
    if (!result.hasNextPage) return docs
  }
}

function cents(amount: number) {
  return Math.round(amount * 100)
}

async function findExistingInvoice(payload: Payload, billingKey: string) {
  const result = await payload.find({
    collection: 'referral-invoices',
    where: { billingKey: { equals: billingKey } },
    limit: 1,
    depth: 0,
  })
  return result.docs[0] || null
}

async function eligibleItems(
  payload: Payload,
  relationTo: ReferralCollection,
  referralId: string,
  cutoff: string,
  excludeInvoiceId?: string,
) {
  const clients = (await findAll((page) =>
    payload.find({
      collection: 'clients',
      where: { and: [{ 'referral.relationTo': { equals: relationTo } }, { 'referral.value': { equals: referralId } }] },
      depth: 0,
      limit: PAGE_SIZE,
      page,
    }),
  )) as Client[]
  if (clients.length === 0) return []

  const clientById = new Map(clients.map((client) => [String(client.id), client]))
  const tests: DrugTest[] = []
  for (let start = 0; start < clients.length; start += PAGE_SIZE) {
    const ids = clients.slice(start, start + PAGE_SIZE).map((client) => String(client.id))
    tests.push(
      ...(await findAll((page) =>
        payload.find({
          collection: 'drug-tests',
          where: {
            and: [
              { relatedClient: { in: ids } },
              { 'payment.balanceDue': { greater_than: 0 } },
              { collectionDate: { less_than: cutoff } },
            ],
          },
          depth: 0,
          limit: PAGE_SIZE,
          page,
          sort: 'collectionDate',
        }),
      )),
    )
  }

  const priorInvoices = await findAll((page) =>
    payload.find({
      collection: 'referral-invoices',
      depth: 0,
      limit: PAGE_SIZE,
      page,
    }),
  )
  const alreadyInvoiced = new Set(
    priorInvoices
      .filter((invoice) => invoice.status !== 'void' && String(invoice.id) !== excludeInvoiceId)
      .flatMap((invoice) => invoice.items?.map((item) => idOf(item.drugTest)) || []),
  )

  return tests.flatMap((test): InvoiceItem[] => {
    const clientId = idOf(test.relatedClient)
    const client = clientId ? clientById.get(clientId) : null
    const amount = test.payment?.balanceDue
    if (!client || !test.collectionDate || !amount || cents(amount) <= 0 || alreadyInvoiced.has(String(test.id)))
      return []
    return [
      {
        drugTest: String(test.id),
        client: clientId!,
        clientName: `${client.firstName} ${client.lastName}`.trim(),
        collectionDate: test.collectionDate,
        testType: getTestTypeLabel(test.testType) || test.testType,
        amount: cents(amount) / 100,
      },
    ]
  })
}

export async function previewReferralInvoice(
  payload: Payload,
  relationTo: ReferralCollection,
  referralId: string,
  month: string,
) {
  const currentMonth = currentBillingMonth()
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || month > currentMonth)
    throw new Error('Choose the current or an earlier billing month in YYYY-MM format.')
  const cutoff = month === currentMonth ? new Date().toISOString() : billingPeriodEnd(month)
  const referral = (await payload.findByID({ collection: relationTo, id: referralId, depth: 0 })) as Referral
  const billingKey = `${relationTo}:${referralId}:${month}`
  const existing = await findExistingInvoice(payload, billingKey)
  const items = existing?.items || (await eligibleItems(payload, relationTo, referralId, cutoff))
  const replacementItems =
    existing?.status === 'sent'
      ? await eligibleItems(payload, relationTo, referralId, cutoff, String(existing.id))
      : null
  const history = await findAll((page) =>
    payload.find({
      collection: 'referral-invoices',
      where: {
        and: [{ 'referral.relationTo': { equals: relationTo } }, { 'referral.value': { equals: referralId } }],
      },
      depth: 0,
      limit: PAGE_SIZE,
      page,
      sort: '-createdAt',
    }),
  )
  return {
    referral: {
      id: String(referral.id),
      name: referral.name,
      isBillable: Boolean(referral.isBillable),
      billingEmail: referral.billingEmail || null,
    },
    billingKey,
    month,
    items,
    amount: items.reduce((total, item) => total + cents(item.amount), 0) / 100,
    status: existing?.status || 'new',
    invoiceId: existing?.id || null,
    paidAt: existing?.paidAt || null,
    paymentMethod: existing?.paymentMethod || null,
    history: history.map((invoice) => ({
      id: invoice.id,
      billingMonth: invoice.billingMonth,
      amount: invoice.amount,
      status: invoice.status,
      billingEmail: invoice.billingEmail,
      emailSentAt: invoice.emailSentAt || null,
      paidAt: invoice.paidAt || null,
      paymentMethod: invoice.paymentMethod || null,
      checkNumber: invoice.checkNumber || null,
      hostedInvoiceUrl: invoice.hostedInvoiceUrl || null,
      invoicePdfUrl: invoice.invoicePdfUrl || null,
      replacesInvoiceNumber: invoice.replacesInvoiceNumber || null,
    })),
    unappliedAmount: existing?.unappliedAmount || 0,
    hostedInvoiceUrl: existing?.hostedInvoiceUrl || null,
    invoicePdfUrl: existing?.invoicePdfUrl || null,
    emailSentAt: existing?.emailSentAt || null,
    replacesInvoiceNumber: existing?.replacesInvoiceNumber || null,
    upcoming: month === currentMonth && !existing,
    replacement: replacementItems
      ? {
          items: replacementItems,
          amount: replacementItems.reduce((total, item) => total + cents(item.amount), 0) / 100,
        }
      : null,
  }
}

async function emailReferralInvoice(
  payload: Payload,
  invoice: ReferralInvoice,
  referralName: string,
  stripeInvoice: Stripe.Invoice,
) {
  if (!stripeInvoice.id) throw new Error('Stripe did not return an invoice ID.')
  const pdfUrl = stripeInvoice.invoice_pdf
  if (!pdfUrl) throw new Error('Stripe has not generated the invoice PDF yet. Retry sending shortly.')
  const url = new URL(pdfUrl)
  if (url.protocol !== 'https:' || !url.hostname.endsWith('.stripe.com'))
    throw new Error('Stripe returned an unexpected invoice PDF URL.')
  const response = await fetch(pdfUrl)
  if (!response.ok) throw new Error(`Unable to download the Stripe invoice PDF (${response.status}).`)
  const bytes = Buffer.from(await response.arrayBuffer())
  if (bytes.length > 15_000_000 || bytes.subarray(0, 5).toString() !== '%PDF-')
    throw new Error('Stripe returned an invalid or oversized invoice PDF.')
  const email = await buildReferralInvoiceEmail({
    referralName,
    month: invoice.billingMonth,
    amount: invoice.amount,
    invoiceNumber: stripeInvoice.number,
    dueDate: stripeInvoice.due_date,
    paymentUrl: stripeInvoice.hosted_invoice_url || null,
    replacesInvoiceNumber: invoice.replacesInvoiceNumber || null,
  })
  const recipients = resolveOutboundNotificationRecipients([invoice.billingEmail])
  await payload.sendEmail({
    to: recipients.recipients,
    from: payload.email.defaultFromAddress,
    subject: prefixNonLiveEmailSubject(email.subject),
    html: email.html,
    attachments: [
      { filename: `MI-Drug-Test-invoice-${stripeInvoice.id}.pdf`, content: bytes, contentType: 'application/pdf' },
    ],
  })
  await payload.update({
    collection: 'referral-invoices',
    id: invoice.id,
    data: {
      status: stripeInvoice.status === 'paid' ? 'paid' : 'sent',
      hostedInvoiceUrl: stripeInvoice.hosted_invoice_url || undefined,
      invoicePdfUrl: pdfUrl,
      sentAt: invoice.sentAt || new Date().toISOString(),
      emailSentAt: new Date().toISOString(),
    },
  })
}

async function linkInvoiceTests(payload: Payload, invoice: ReferralInvoice) {
  for (const item of invoice.items || []) {
    const testId = idOf(item.drugTest)
    if (!testId) continue
    const test = await payload.findByID({ collection: 'drug-tests', id: testId, depth: 0 })
    if ((test.payment?.balanceDue || 0) <= 0) continue
    if (idOf(test.payment?.referralInvoice) === String(invoice.id)) continue
    await payload.update({
      collection: 'drug-tests',
      id: testId,
      data: { payment: { ...test.payment, status: 'invoiced', referralInvoice: invoice.id } },
    })
  }
}

export async function sendReferralInvoice(
  payload: Payload,
  relationTo: ReferralCollection,
  referralId: string,
  month: string,
  stripe: Stripe,
  options: { emailExisting?: boolean; replacesInvoiceId?: string; replacesInvoiceNumber?: string } = {},
) {
  billingPeriodEnd(month)
  const preview = await previewReferralInvoice(payload, relationTo, referralId, month)
  if (!preview.referral.isBillable || !preview.referral.billingEmail)
    throw new Error('Referral monthly billing and billing email are required.')
  if (preview.items.length === 0) return { status: 'empty' as const, billingKey: preview.billingKey }
  if (preview.items.length > STRIPE_ITEM_LIMIT)
    throw new Error('More than 250 tests need invoicing; contact an administrator to split the invoice.')
  if (preview.status === 'paid' || (preview.status === 'sent' && (!options.emailExisting || preview.emailSentAt))) {
    if (preview.status === 'sent') {
      const existing = await findExistingInvoice(payload, preview.billingKey)
      if (existing) await linkInvoiceTests(payload, existing)
    }
    return { status: preview.status, billingKey: preview.billingKey }
  }

  let invoice = await findExistingInvoice(payload, preview.billingKey)
  if (invoice?.status === 'sent') {
    if (!invoice.stripeInvoiceId) throw new Error('The existing invoice has no Stripe invoice ID.')
    const stripeInvoice = await stripe.invoices.retrieve(invoice.stripeInvoiceId)
    if (stripeInvoice.status === 'paid') {
      await settleReferralInvoice(payload, stripeInvoice)
      return { status: 'paid' as const, billingKey: preview.billingKey, stripeInvoiceId: stripeInvoice.id }
    }
    if (stripeInvoice.status !== 'open')
      throw new Error(`Stripe invoice ${stripeInvoice.id} is ${stripeInvoice.status}.`)
    await emailReferralInvoice(payload, invoice, preview.referral.name, stripeInvoice)
    await linkInvoiceTests(payload, invoice)
    return { status: 'sent' as const, billingKey: preview.billingKey, stripeInvoiceId: stripeInvoice.id }
  }
  if (!invoice) {
    try {
      invoice = await payload.create({
        collection: 'referral-invoices',
        data: {
          billingKey: preview.billingKey,
          billingMonth: month,
          referral: { relationTo, value: referralId },
          billingEmail: preview.referral.billingEmail,
          amount: preview.amount,
          status: 'preparing',
          items: preview.items,
          replacesInvoice: options.replacesInvoiceId,
          replacesInvoiceNumber: options.replacesInvoiceNumber,
        },
      })
    } catch (error) {
      invoice = await findExistingInvoice(payload, preview.billingKey)
      if (!invoice) throw error
    }
  }

  const referral = (await payload.findByID({ collection: relationTo, id: referralId, depth: 0 })) as Referral
  const customer = referral.stripeCustomerId
    ? await stripe.customers.retrieve(referral.stripeCustomerId)
    : await stripe.customers.create(
        {
          name: referral.name,
          email: preview.referral.billingEmail,
          metadata: { referralCollection: relationTo, referralId },
        },
        { idempotencyKey: `referral-customer:${relationTo}:${referralId}` },
      )
  if (customer.deleted) throw new Error('The linked Stripe customer was deleted.')
  await stripe.customers.update(customer.id, { name: referral.name, email: preview.referral.billingEmail })
  if (!referral.stripeCustomerId) {
    await payload.update({ collection: relationTo, id: referralId, data: { stripeCustomerId: customer.id } })
  }

  let stripeInvoice = invoice.stripeInvoiceId
    ? await stripe.invoices.retrieve(invoice.stripeInvoiceId)
    : await stripe.invoices.create(
        {
          customer: customer.id,
          collection_method: 'send_invoice',
          days_until_due: 30,
          auto_advance: false,
          automatic_tax: { enabled: false },
          default_tax_rates: [],
          pending_invoice_items_behavior: 'exclude',
          footer: REFERRAL_CHECK_FOOTER,
          ...(invoice.replacesInvoiceNumber
            ? { description: `Replaces invoice ${invoice.replacesInvoiceNumber}` }
            : {}),
          metadata: { referralInvoiceId: String(invoice.id), billingKey: preview.billingKey },
        },
        {
          idempotencyKey: invoice.replacesInvoice
            ? `referral-invoice:${invoice.id}`
            : `referral-invoice:${preview.billingKey}`,
        },
      )

  if (!invoice.stripeInvoiceId) {
    invoice = await payload.update({
      collection: 'referral-invoices',
      id: invoice.id,
      data: { stripeCustomerId: customer.id, stripeInvoiceId: stripeInvoice.id },
    })
  }

  if (!stripeInvoice.id) throw new Error('Stripe did not return an invoice ID.')
  const stripeInvoiceId = stripeInvoice.id

  if (stripeInvoice.status === 'draft') {
    const duplicateMemo = stripeInvoice.description?.startsWith(`${month} drug tests\n`)
    if (stripeInvoice.footer !== REFERRAL_CHECK_FOOTER || duplicateMemo) {
      stripeInvoice = await stripe.invoices.update(stripeInvoiceId, {
        footer: REFERRAL_CHECK_FOOTER,
        ...(duplicateMemo ? { description: '' } : {}),
      })
    }
    for (const item of invoice.items || []) {
      await stripe.invoiceItems.create(
        {
          customer: customer.id,
          invoice: stripeInvoiceId,
          currency: 'usd',
          amount: cents(item.amount),
          discountable: false,
          description: `${item.testType} — ${item.clientName} (${collectionDateInDetroit(item.collectionDate)})`.slice(
            0,
            500,
          ),
          metadata: { drugTestId: idOf(item.drugTest) || '' },
        },
        { idempotencyKey: `referral-invoice-item:v2:${invoice.id}:${idOf(item.drugTest)}` },
      )
    }
    stripeInvoice = await stripe.invoices.finalizeInvoice(
      stripeInvoiceId,
      {},
      { idempotencyKey: `referral-finalize:${invoice.id}` },
    )
  }
  if (stripeInvoice.status !== 'open' && stripeInvoice.status !== 'paid') {
    throw new Error(`Stripe invoice ${stripeInvoice.id} is ${stripeInvoice.status}; it cannot be emailed.`)
  }
  if (stripeInvoice.status === 'paid') {
    await settleReferralInvoice(payload, stripeInvoice)
    return { status: 'paid' as const, billingKey: preview.billingKey, stripeInvoiceId: stripeInvoice.id }
  }
  await emailReferralInvoice(payload, invoice, referral.name, stripeInvoice)
  await linkInvoiceTests(payload, invoice)
  return { status: 'sent' as const, billingKey: preview.billingKey, stripeInvoiceId: stripeInvoice.id }
}

/** Replace a finalized, unpaid invoice with a fresh snapshot of the referral's current balances. */
export async function replaceReferralInvoice(
  payload: Payload,
  relationTo: ReferralCollection,
  referralId: string,
  month: string,
  stripe: Stripe,
) {
  billingPeriodEnd(month)
  const billingKey = `${relationTo}:${referralId}:${month}`
  const invoice = await findExistingInvoice(payload, billingKey)
  if (!invoice || invoice.status !== 'sent' || !invoice.stripeInvoiceId)
    throw new Error('Only an existing unpaid referral invoice can be replaced.')

  const preview = await previewReferralInvoice(payload, relationTo, referralId, month)
  if (!preview.referral.isBillable || !preview.referral.billingEmail)
    throw new Error('Referral monthly billing and billing email are required.')
  if (!preview.replacement?.items.length)
    throw new Error('No unpaid tests remain for a replacement invoice. The existing invoice was not changed.')
  if (preview.replacement.items.length > STRIPE_ITEM_LIMIT)
    throw new Error('More than 250 tests need invoicing; contact an administrator to split the invoice.')

  const stripeInvoice = await stripe.invoices.retrieve(invoice.stripeInvoiceId)
  if (stripeInvoice.status !== 'open' && stripeInvoice.status !== 'void')
    throw new Error(`Stripe invoice ${stripeInvoice.id} is ${stripeInvoice.status} and cannot be replaced.`)
  if ((stripeInvoice.amount_paid || 0) > 0)
    throw new Error('This invoice has a payment or partial payment and cannot be replaced.')

  if (stripeInvoice.status === 'open') {
    const voided = await stripe.invoices.voidInvoice(
      invoice.stripeInvoiceId,
      {},
      {
        idempotencyKey: `referral-void:${invoice.id}`,
      },
    )
    if (voided.status !== 'void') throw new Error('Stripe did not void the previous invoice.')
  }
  await payload.update({
    collection: 'referral-invoices',
    id: invoice.id,
    data: {
      status: 'void',
      billingKey: `${billingKey}:void:${invoice.id}`,
      voidedAt: new Date().toISOString(),
    },
  })
  for (const item of invoice.items || []) {
    const testId = idOf(item.drugTest)
    if (!testId) continue
    const test = await payload.findByID({ collection: 'drug-tests', id: testId, depth: 0 })
    if (idOf(test.payment?.referralInvoice) !== String(invoice.id)) continue
    await payload.update({
      collection: 'drug-tests',
      id: testId,
      data: {
        payment: { ...test.payment, status: test.payment?.amountPaid ? 'partial' : 'unpaid', referralInvoice: null },
      },
    })
  }
  return sendReferralInvoice(payload, relationTo, referralId, month, stripe, {
    replacesInvoiceId: String(invoice.id),
    replacesInvoiceNumber: stripeInvoice.number || stripeInvoice.id,
  })
}

/** Record a received check in Stripe and immediately settle the local test ledger. */
export async function recordReferralCheckPayment(
  payload: Payload,
  invoiceId: string,
  relationTo: ReferralCollection,
  referralId: string,
  checkNumber: string,
  checkReceivedAt: string,
  stripe: Stripe,
) {
  const invoice = await payload.findByID({ collection: 'referral-invoices', id: invoiceId, depth: 0 })
  if (invoice.referral?.relationTo !== relationTo || idOf(invoice.referral.value) !== referralId)
    throw new Error('Invoice does not belong to the selected referral.')
  if (invoice.status === 'paid') return { status: 'paid' as const }
  if (invoice.status !== 'sent' || !invoice.stripeInvoiceId)
    throw new Error('Only a sent, unpaid invoice can be marked paid by check.')
  const existing = await stripe.invoices.retrieve(invoice.stripeInvoiceId)
  if (existing.status !== 'open') {
    if (existing.status === 'paid') {
      await settleReferralInvoice(payload, existing)
      return { status: 'paid' as const }
    }
    throw new Error(`Stripe invoice ${existing.id} is ${existing.status}.`)
  }
  if (existing.amount_paid > 0)
    throw new Error('This invoice has a partial online payment. Reconcile it in Stripe before recording a check.')
  await payload.update({
    collection: 'referral-invoices',
    id: invoice.id,
    data: { paymentMethod: 'check', checkNumber: checkNumber || undefined, checkReceivedAt },
  })
  let paid: Stripe.Invoice
  try {
    paid = await stripe.invoices.pay(
      invoice.stripeInvoiceId,
      { paid_out_of_band: true },
      { idempotencyKey: `referral-check:${invoice.id}` },
    )
  } catch (error) {
    const latest = await stripe.invoices.retrieve(invoice.stripeInvoiceId)
    if (latest.status === 'paid') {
      paid = latest
    } else {
      await payload.update({
        collection: 'referral-invoices',
        id: invoice.id,
        data: { paymentMethod: null, checkNumber: null, checkReceivedAt: null },
      })
      throw error
    }
  }
  if (paid.status !== 'paid') throw new Error('Stripe did not mark the invoice paid.')
  await settleReferralInvoice(payload, paid)
  return { status: 'paid' as const }
}

export async function sendMonthlyReferralInvoices(payload: Payload, month: string, stripe: Stripe) {
  billingPeriodEnd(month)
  const results: Array<{ billingKey: string; status: string; error?: string }> = []
  const attempted = new Set<string>()
  const preparing = await findAll((page) =>
    payload.find({
      collection: 'referral-invoices',
      where: { status: { equals: 'preparing' } },
      depth: 0,
      limit: PAGE_SIZE,
      page,
    }),
  )
  for (const invoice of preparing) {
    if (invoice.billingMonth > month) continue
    const relationTo = invoice.referral?.relationTo
    const referralId = idOf(invoice.referral?.value)
    if ((relationTo !== 'courts' && relationTo !== 'employers') || !referralId) continue
    const referral = await payload.findByID({ collection: relationTo, id: referralId, depth: 0 }).catch(() => null)
    if (!referral?.isBillable) continue
    attempted.add(invoice.billingKey)
    try {
      results.push(await sendReferralInvoice(payload, relationTo, referralId, invoice.billingMonth, stripe))
    } catch (error) {
      payload.logger.error({ msg: `Referral invoice retry failed for ${invoice.billingKey}`, err: error })
      results.push({
        billingKey: invoice.billingKey,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Invoice failed.',
      })
    }
  }
  for (const relationTo of ['courts', 'employers'] as const) {
    const referrals = await findAll((page) =>
      payload.find({
        collection: relationTo,
        where: { isBillable: { equals: true } },
        depth: 0,
        limit: PAGE_SIZE,
        page,
      }),
    )
    for (const referral of referrals) {
      if (attempted.has(`${relationTo}:${referral.id}:${month}`)) continue
      try {
        results.push(await sendReferralInvoice(payload, relationTo, String(referral.id), month, stripe))
      } catch (error) {
        const billingKey = `${relationTo}:${referral.id}:${month}`
        payload.logger.error({ msg: `Referral invoice failed for ${billingKey}`, err: error })
        results.push({
          billingKey,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Invoice failed.',
        })
      }
    }
  }
  return results
}
