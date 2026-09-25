import config from '@payload-config'
import { getPayload } from 'payload'
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { z } from 'zod'
import {
  currentBillingMonth,
  previewReferralInvoice,
  previousBillingMonth,
  replaceReferralInvoice,
  sendReferralInvoice,
} from '@/lib/referral-invoices'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const inputSchema = z.object({
  relationTo: z.enum(['courts', 'employers']),
  referralId: z.string().trim().min(1),
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .optional(),
  action: z.enum(['email', 'replace']).optional(),
})

async function authorize(request: NextRequest) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user || user.collection !== 'admins') return { payload, authorized: false }
  return { payload, authorized: true }
}

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } })
}

export async function GET(request: NextRequest) {
  const { payload, authorized } = await authorize(request)
  if (!authorized) return json({ error: 'Admin account required.' }, 403)
  const input = inputSchema.safeParse(Object.fromEntries(request.nextUrl.searchParams))
  if (!input.success) return json({ error: 'Invalid referral or billing month.' }, 400)
  try {
    return json(
      await previewReferralInvoice(
        payload,
        input.data.relationTo,
        input.data.referralId,
        input.data.month || currentBillingMonth(),
      ),
    )
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Unable to preview invoice.' }, 400)
  }
}

export async function POST(request: NextRequest) {
  const { payload, authorized } = await authorize(request)
  if (!authorized) return json({ error: 'Admin account required.' }, 403)
  const input = inputSchema.safeParse(await request.json().catch(() => null))
  if (!input.success) return json({ error: 'Invalid referral or billing month.' }, 400)
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) return json({ error: 'Stripe is not configured.' }, 503)
  try {
    const stripe = new Stripe(key, {})
    if (input.data.action === 'replace') {
      return json(
        await replaceReferralInvoice(
          payload,
          input.data.relationTo,
          input.data.referralId,
          input.data.month || previousBillingMonth(),
          stripe,
        ),
      )
    }
    return json(
      await sendReferralInvoice(
        payload,
        input.data.relationTo,
        input.data.referralId,
        input.data.month || previousBillingMonth(),
        stripe,
        { emailExisting: true },
      ),
    )
  } catch (error) {
    payload.logger.error({ msg: 'Unable to send referral invoice', err: error })
    return json({ error: error instanceof Error ? error.message : 'Unable to send invoice.' }, 500)
  }
}
