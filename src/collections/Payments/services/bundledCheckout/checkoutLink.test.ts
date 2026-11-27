import type { Payload, PayloadRequest } from 'payload'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { bundledCheckoutLinkEndpoint, getCheckoutEmailLink } from './checkoutLink'
import { emailCheckout } from './email'

vi.mock('@/utilities/baseUrl', () => ({ baseUrl: 'https://www.midrugtest.example' }))

const paymentId = '507f1f77bcf86cd799439011'
const sessionId = 'cs_test_session'
const fullUrl = `https://checkout.stripe.com/g/pay/${sessionId}#fid${'a'.repeat(250)}%2Fb%3D`

function setup() {
  const payment = {
    status: 'pending',
    source: 'stripe-checkout',
    createdAt: new Date().toISOString(),
    stripeCheckoutSessionId: sessionId,
    stripeCheckoutUrl: fullUrl,
    bundledCheckout: { requestId: 'request' },
  }
  const findByID = vi.fn(async () => payment)
  const payload = {
    secret: 'test-only-secret',
    findByID,
    email: { defaultFromName: 'MI Drug Test', defaultFromAddress: 'example@example.com' },
  } as unknown as Payload
  const shortUrl = getCheckoutEmailLink(payload, paymentId)
  const token = new URL(shortUrl).pathname.split('/').at(-1)!
  const open = (value = token) => bundledCheckoutLinkEndpoint.handler(
    Object.assign(new Request(shortUrl), { payload, routeParams: { token: value } }) as PayloadRequest,
  )
  return { payment, findByID, payload, shortUrl, token, open }
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('bundled checkout email link', () => {
  it('sends the same fragment-free link in both versions and redirects to the complete Stripe URL', async () => {
    const { payload, shortUrl, open } = setup()
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('RESEND_API_KEY', 'test')
    vi.stubGlobal('fetch', vi.fn(async (_url, options: RequestInit) => {
      const email = JSON.parse(String(options.body))
      expect(email.html).toContain(`href="${shortUrl}"`)
      expect(email.text).toContain(shortUrl)
      expect(email.text).not.toContain('checkout.stripe.com')
      expect(new URL(shortUrl).hash).toBe('')
      return Response.json({ id: 'email' })
    }))

    await expect(emailCheckout(payload, paymentId, 'client@example.com', [{
      drugTest: paymentId, label: '11/20/2026 screen', kind: 'screen', amountCents: 4000,
    }], 4000)).resolves.toBe('email')

    const response = await open()
    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe(fullUrl)
    expect(response.headers.get('cache-control')).toContain('no-store')
  })

  it('rejects tampered signatures before querying the payment', async () => {
    const { token, findByID, open } = setup()
    const tampered = token.slice(0, -1) + (token.endsWith('a') ? 'b' : 'a')
    expect((await open(tampered)).status).toBe(404)
    expect(findByID).not.toHaveBeenCalled()
  })

  it('rejects unavailable payments and invalid Stripe destinations', async () => {
    const { payment, open } = setup()
    payment.status = 'posted'
    expect((await open()).status).toBe(404)
    payment.status = 'pending'
    payment.createdAt = new Date(0).toISOString()
    expect((await open()).status).toBe(404)
    payment.createdAt = new Date().toISOString()
    payment.stripeCheckoutUrl = fullUrl.split('#')[0]
    expect((await open()).status).toBe(404)
    payment.stripeCheckoutUrl = fullUrl.replace('checkout.stripe.com', 'example.com')
    expect((await open()).status).toBe(404)
  })
})
