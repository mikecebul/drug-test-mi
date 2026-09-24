import Stripe from 'stripe'
import type { Payload } from 'payload'
import type { Client, Court, DrugTest, Employer, ReferralInvoice } from '@/payload-types'
import { getTestTypeLabel } from '@/config/test-types'
import { billingPeriodEnd, collectionDateInDetroit } from '@/lib/referral-invoices/date'
export { previousBillingMonth } from '@/lib/referral-invoices/date'

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

function memo(items: InvoiceItem[], month: string) {
  const lines = items.map((item) => `${item.clientName} — ${collectionDateInDetroit(item.collectionDate)}`)
  const full = `${month} drug tests\n${lines.join('\n')}`
  if (full.length <= 450) return full
  return `${full.slice(0, 405).trimEnd()}\nSee line items for all client names and dates.`
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

async function eligibleItems(payload: Payload, relationTo: ReferralCollection, referralId: string, month: string) {
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
              { collectionDate: { less_than: billingPeriodEnd(month) } },
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
    priorInvoices.flatMap((invoice) => invoice.items?.map((item) => idOf(item.drugTest)) || []),
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
  billingPeriodEnd(month)
  const referral = (await payload.findByID({ collection: relationTo, id: referralId, depth: 0 })) as Referral
  const billingKey = `${relationTo}:${referralId}:${month}`
  const existing = await findExistingInvoice(payload, billingKey)
  const items = existing?.items || (await eligibleItems(payload, relationTo, referralId, month))
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
    unappliedAmount: existing?.unappliedAmount || 0,
    hostedInvoiceUrl: existing?.hostedInvoiceUrl || null,
  }
}

export async function sendReferralInvoice(
  payload: Payload,
  relationTo: ReferralCollection,
  referralId: string,
  month: string,
  stripe: Stripe,
) {
  const preview = await previewReferralInvoice(payload, relationTo, referralId, month)
  if (!preview.referral.isBillable || !preview.referral.billingEmail)
    throw new Error('Referral monthly billing and billing email are required.')
  if (preview.items.length === 0) return { status: 'empty' as const, billingKey: preview.billingKey }
  if (preview.items.length > STRIPE_ITEM_LIMIT)
    throw new Error('More than 250 tests need invoicing; contact an administrator to split the invoice.')
  if (preview.status === 'sent' || preview.status === 'paid')
    return { status: preview.status, billingKey: preview.billingKey }

  let invoice = await findExistingInvoice(payload, preview.billingKey)
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
          description: memo(invoice.items!, month),
          metadata: { referralInvoiceId: String(invoice.id), billingKey: preview.billingKey },
        },
        { idempotencyKey: `referral-invoice:${preview.billingKey}` },
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
    throw new Error(`Stripe invoice ${stripeInvoice.id} is ${stripeInvoice.status}; it was not sent.`)
  }
  if (stripeInvoice.status === 'open') {
    stripeInvoice = await stripe.invoices.sendInvoice(
      stripeInvoiceId,
      {},
      { idempotencyKey: `referral-send:${invoice.id}` },
    )
  }
  await payload.update({
    collection: 'referral-invoices',
    id: invoice.id,
    data: {
      status: stripeInvoice.status === 'paid' ? 'paid' : 'sent',
      hostedInvoiceUrl: stripeInvoice.hosted_invoice_url || undefined,
      sentAt: new Date().toISOString(),
    },
  })
  return { status: 'sent' as const, billingKey: preview.billingKey, stripeInvoiceId: stripeInvoice.id }
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
