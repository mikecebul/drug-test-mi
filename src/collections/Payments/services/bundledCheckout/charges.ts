import type { DrugTest, Payment } from '@/payload-types'
import { APP_TIMEZONE } from '@/lib/date-utils'
import { isNonLiveEmailMode } from '@/lib/email-safety'
import { isClientBilledToReferral } from '@/lib/referral-invoices/payer'
import { readRelationshipId } from '../applyPayment'
import type { PayloadRequest } from 'payload'
import { z } from 'zod/v3'

type Bundle = NonNullable<Payment['bundledCheckout']>
export type BundledCharge = NonNullable<Bundle['charges']>[number]

export const MAX_CHECKOUT_CENTS = 99_999_999
export const chargeInput = z.object({
  testId: z.string().regex(/^[a-f0-9]{24}$/).describe('Payload drug-test ID'),
  kind: z.enum(['screen', 'confirmation', 'new-confirmation']),
  amountCents: z.number().int().min(1).max(MAX_CHECKOUT_CENTS),
}).strict()

export const bundleInput = {
  clientId: z.string().regex(/^[a-f0-9]{24}$/).describe('Payload client ID'),
  charges: z.array(chargeInput).min(1).max(25).describe('Exact charges, at most one per test'),
}

const dateFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: APP_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

export const toCents = (dollars: number | null | undefined) => Math.round((dollars ?? 0) * 100)

export function getChargeBalance(test: Pick<DrugTest, 'payment'>) {
  const due = toCents(test.payment?.amountDue)
  const paid = toCents(test.payment?.amountPaid)
  const fee = toCents(test.payment?.confirmationFeeDue)
  const screen = Math.max(0, due - fee - paid)
  const confirmation = Math.max(0, Math.min(fee, due - paid))
  return { due, paid, fee, screen, confirmation }
}

export function isReferralInvoiced(test: Pick<DrugTest, 'payment'>) {
  return Boolean(test.payment?.status === 'invoiced' || test.payment?.referralInvoice)
}

export async function previewBundle(req: PayloadRequest, clientId: string, charges: z.infer<typeof chargeInput>[]) {
  const { payload } = req
  const totalCents = charges.reduce((sum, charge) => sum + charge.amountCents, 0)
  if (totalCents < 50 || totalCents > MAX_CHECKOUT_CENTS) {
    throw new Error('The total must be between $0.50 and $999,999.99 USD.')
  }

  const testIds = charges.map((charge) => charge.testId)
  if (new Set(testIds).size !== testIds.length) throw new Error('Select each test at most once.')

  const client = await payload.findByID({ collection: 'clients', id: clientId, depth: 0, req, overrideAccess: false })
  if (!client.email) throw new Error('The client needs an email address on file.')
  if (await isClientBilledToReferral(payload, clientId, req)) {
    throw new Error('This client is billed through a referral.')
  }

  const tests = await payload.find({
    collection: 'drug-tests',
    where: { id: { in: testIds }, relatedClient: { equals: clientId } },
    depth: 0,
    limit: testIds.length,
    req,
    overrideAccess: false,
  })
  const items: BundledCharge[] = charges.map(({ testId, kind, amountCents }) => {
    const test = tests.docs.find(({ id }) => id === testId)
    if (!test || isReferralInvoiced(test)) throw new Error(`Test ${testId} is unavailable for client billing.`)
    const balance = getChargeBalance(test)
    switch (kind) {
      case 'screen':
        if (balance.screen !== amountCents) throw new Error(`The screen balance has changed for test ${testId}.`)
        break
      case 'confirmation':
        if (balance.screen || balance.confirmation !== amountCents) {
          throw new Error(`The existing confirmation fee cannot be paid for test ${testId} with this amount.`)
        }
        break
      case 'new-confirmation':
        if (balance.fee || balance.screen || balance.paid !== balance.due || balance.due <= 0) {
          throw new Error(`Test ${testId} must have a paid screen and no recorded confirmation fee.`)
        }
        break
    }
    const day = dateFormat.format(new Date(test.collectionDate || test.createdAt))
    return { drugTest: test.id, kind, amountCents, label: `${day} ${kind === 'screen' ? 'screen' : 'confirmation fee'}` }
  })

  return {
    clientId,
    recipientEmail: client.email,
    clientName: `${client.firstName} ${client.lastName}`,
    emailRedirectedInThisEnvironment: isNonLiveEmailMode(),
    totalCents,
    charges: items,
  }
}

export function hasSameCharges(stored: BundledCharge[], requested: z.infer<typeof chargeInput>[]) {
  return stored.length === requested.length && stored.every((item) =>
    requested.some((charge) =>
      charge.testId === readRelationshipId(item.drugTest) && charge.kind === item.kind && charge.amountCents === item.amountCents,
    )
  )
}
