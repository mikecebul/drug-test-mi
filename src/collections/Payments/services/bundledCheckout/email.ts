import type { Payload } from 'payload'
import { prefixNonLiveEmailSubject, resolveOutboundNotificationRecipients } from '@/lib/email-safety'
import type { BundledCharge } from './charges'

export async function emailCheckout(
  payload: Payload,
  paymentId: string,
  to: string,
  checkoutUrl: string,
  charges: BundledCharge[],
  totalCents: number,
): Promise<string | undefined> {
  const money = (cents: number) => `$${(cents / 100).toFixed(2)}`
  const text = [
    'You can pay the following MI Drug Test charges by card through Stripe.',
    '',
    ...charges.map((charge) => `${charge.label}  ${money(charge.amountCents)}`),
    '',
    `Total due  ${money(totalCents)}`,
    '',
    checkoutUrl,
  ].join('\n')
  const subject = prefixNonLiveEmailSubject('Your MI Drug Test payment link')
  const { recipients } = resolveOutboundNotificationRecipients([to])

  if (process.env.NODE_ENV !== 'production') {
    await payload.sendEmail({ to: recipients, subject, text })
    return
  }

  // Payload's Resend adapter cannot set the provider's idempotency header.
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `client-checkout/${paymentId}`,
    },
    body: JSON.stringify({
      from: `${payload.email.defaultFromName} <${payload.email.defaultFromAddress}>`,
      to: recipients,
      subject,
      text,
    }),
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) throw new Error(`Resend could not confirm email acceptance (HTTP ${response.status}). Retry with the same request ID.`)
  const result = await response.json() as { id?: string }
  if (!result.id) throw new Error('Resend did not return an email ID. Retry with the same request ID.')
  return result.id
}
