import config from '@payload-config'
import { getPayload, createLocalReq } from 'payload'
import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { AccountPaymentRejection, postAccountPayment } from '@/collections/Payments/services/accountPayment'
import { PaymentTransactionsUnavailableError } from '@/collections/Payments/services/withPayloadTransaction'
import { clientBalances, clientName, headshotUrl } from '@/views/staff/summary-helpers'

const command = z.object({
  clientId: z.string().min(1),
  amount: z.number().finite().positive(),
  operationId: z.string().min(8).max(200),
  sendReceipt: z.boolean().optional(),
})
async function admin(request: NextRequest) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: request.headers })
  if (user?.collection !== 'admins')
    return { response: NextResponse.json({ message: 'Admin access required.' }, { status: user ? 403 : 401 }) }
  return { payload, user }
}
const json = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } })
export async function GET(request: NextRequest) {
  const auth = await admin(request)
  if (auth.response) return auth.response
  try {
    const clientId = request.nextUrl.searchParams.get('clientId')
    if (!clientId) return json({ message: 'Select a client.' }, 400)
    const req = await createLocalReq({ user: auth.user }, auth.payload)
    const client = await auth.payload.findByID({
      collection: 'clients',
      id: clientId,
      depth: 1,
      req,
      overrideAccess: false,
    })
    const balances = await clientBalances(auth.payload, clientId, req)
    return json({
      client: {
        id: client.id,
        name: clientName(client),
        firstName: client.firstName,
        lastName: client.lastName,
        dob: client.dob,
        email: client.disableClientEmails ? null : client.email,
        headshot: headshotUrl(client),
        creditBalance: client.creditBalance || 0,
      },
      ...balances,
    })
  } catch {
    return json({ message: 'Unable to load this client’s balance. Refresh and try again.' }, 400)
  }
}
export async function POST(request: NextRequest) {
  const auth = await admin(request)
  if (auth.response) return auth.response
  try {
    const input = command.parse(await request.json())
    return json(await postAccountPayment({ ...input, payload: auth.payload, user: auth.user }))
  } catch (error) {
    const rejected =
      error instanceof z.ZodError ||
      error instanceof AccountPaymentRejection ||
      error instanceof PaymentTransactionsUnavailableError
    if (!rejected) auth.payload.logger.error({ err: error, msg: 'Account payment status requires reconciliation.' })
    return json(
      {
        message:
          error instanceof z.ZodError
            ? 'Enter a valid payment amount and client.'
            : error instanceof AccountPaymentRejection || error instanceof PaymentTransactionsUnavailableError
              ? error.message
              : 'Payment status could not be confirmed. Check payment status before recording another payment.',
      },
      rejected ? 400 : 500,
    )
  }
}
