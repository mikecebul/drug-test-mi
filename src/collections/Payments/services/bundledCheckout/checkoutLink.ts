import { createHmac, timingSafeEqual } from 'node:crypto'
import type { Endpoint, Payload } from 'payload'
import { baseUrl } from '@/utilities/baseUrl'
import { getBundleExpiry } from './settle'

const endpoint = '/bundled-checkout'
const responseHeaders = {
  'Cache-Control': 'private, no-store',
  'Referrer-Policy': 'no-referrer',
  'X-Robots-Tag': 'noindex, nofollow',
}

function signPaymentId(secret: string, paymentId: string) {
  return createHmac('sha256', secret).update(`bundled-checkout:${paymentId}`).digest('hex').slice(0, 32)
}

export function getCheckoutEmailLink(payload: Payload, paymentId: string) {
  const token = `${paymentId}-${signPaymentId(payload.secret, paymentId)}`
  return new URL(`/api${endpoint}/${token}`, baseUrl).href
}

function unavailable() {
  return new Response('This payment link is unavailable. Contact MI Drug Test if you still need to pay.', {
    status: 404,
    headers: responseHeaders,
  })
}

export function getStripeCheckoutDestination(sessionId: string, checkoutUrl: string | null | undefined) {
  const url = URL.parse(checkoutUrl || '')
  if (
    !url || url.origin !== 'https://checkout.stripe.com' ||
    url.username || url.password || !url.hash || url.pathname.split('/').at(-1) !== sessionId
  ) return null
  return url.href
}

export const bundledCheckoutLinkEndpoint: Endpoint = {
  path: `${endpoint}/:token`,
  method: 'get',
  handler: async ({ payload, routeParams }) => {
    const token = routeParams?.token
    if (typeof token !== 'string' || !/^[a-f0-9]{24}-[a-f0-9]{32}$/.test(token)) return unavailable()
    const [paymentId, signature] = token.split('-')
    if (!timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(signPaymentId(payload.secret, paymentId), 'hex'))) {
      return unavailable()
    }

    const payment = await payload.findByID({
      collection: 'payments',
      id: paymentId,
      depth: 0,
      overrideAccess: true,
      disableErrors: true,
      select: {
        status: true,
        source: true,
        createdAt: true,
        stripeCheckoutUrl: true,
        stripeCheckoutSessionId: true,
        bundledCheckout: { requestId: true },
      },
    })
    if (
      !payment || payment.status !== 'pending' || payment.source !== 'stripe-checkout' ||
      !payment.bundledCheckout?.requestId || !payment.stripeCheckoutSessionId ||
      getBundleExpiry(payment) <= Date.now() / 1000
    ) return unavailable()

    const stripeUrl = getStripeCheckoutDestination(payment.stripeCheckoutSessionId, payment.stripeCheckoutUrl)
    if (!stripeUrl) return unavailable()

    // Send the saved fragment in Location. Email clients only link the shorter URL above.
    return new Response(null, { status: 302, headers: { ...responseHeaders, Location: stripeUrl } })
  },
}
