import type { Payload } from 'payload'
import { prefixNonLiveEmailSubject, resolveOutboundNotificationRecipients } from '@/lib/email-safety'
import type { BundledCharge } from './charges'
import { getCheckoutEmailLink } from './checkoutLink'

export async function emailCheckout(
  payload: Payload,
  paymentId: string,
  to: string,
  charges: BundledCharge[],
  totalCents: number,
): Promise<string | undefined> {
  const money = (cents: number) => `$${(cents / 100).toFixed(2)}`
  const checkoutUrl = getCheckoutEmailLink(payload, paymentId)
  const escape = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
  const intro = 'You can pay the following MI Drug Test charges by card through Stripe.'
  const items = charges.map((charge) => `${charge.label}  ${money(charge.amountCents)}`)
  const text = [
    intro,
    '',
    ...items,
    '',
    `Total due  ${money(totalCents)}`,
    '',
    checkoutUrl,
  ].join('\n')
  const html = [
    `<p>${intro}</p>`,
    `<ul>${items.map((item) => `<li>${escape(item)}</li>`).join('')}</ul>`,
    `<p><strong>Total due ${money(totalCents)}</strong></p>`,
    `<p><a href="${escape(checkoutUrl)}">Pay securely by card</a></p>`,
  ].join('')
  const subject = prefixNonLiveEmailSubject('Your MI Drug Test payment link')
  const { recipients } = resolveOutboundNotificationRecipients([to])

  if (process.env.NODE_ENV !== 'production') {
    await payload.sendEmail({ to: recipients, subject, html, text })
    return
  }

  // Payload's Resend adapter cannot set the provider's idempotency header.
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `client-checkout/v2/${paymentId}`,
    },
    body: JSON.stringify({
      from: `${payload.email.defaultFromName} <${payload.email.defaultFromAddress}>`,
      to: recipients,
      subject,
      html,
      text,
    }),
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) throw new Error(`Resend could not confirm email acceptance (HTTP ${response.status}). Retry with the same request ID.`)
  const result = await response.json() as { id?: string }
  if (!result.id) throw new Error('Resend did not return an email ID. Retry with the same request ID.')
  return result.id
}
