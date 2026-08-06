import type { Payload } from 'payload'

import {
  buildPaymentReceiptEmail,
  type PaymentReceiptEmailProps,
  type PaymentReceiptType,
} from '@/emails/payments'
import { APP_TIMEZONE } from '@/lib/date-utils'
import { prefixNonLiveEmailSubject, resolveOutboundNotificationRecipients } from '@/lib/email-safety'

export function resolveClientReceiptEmail(input: {
  disableClientEmails?: boolean | null
  email?: string | null
}) {
  if (input.disableClientEmails) return null
  return input.email?.trim() || null
}

export function classifyPaymentReceipt(input: {
  creditAdded: number
  remainingBalance: number
}): PaymentReceiptType {
  if (input.creditAdded > 0) return 'credit-added'
  if (input.remainingBalance > 0) return 'partial'
  return 'paid-in-full'
}

function formatPaymentDate(value: string) {
  const date = new Date(value)
  const validDate = Number.isNaN(date.getTime()) ? new Date() : date

  return `${new Intl.DateTimeFormat('en-US', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: APP_TIMEZONE,
  }).format(validDate)} ET`
}

export async function sendClientPaymentReceipt(input: {
  data: Omit<PaymentReceiptEmailProps, 'paymentDate'> & { collectedAt: string }
  payload: Payload
  receiptEmail: string
}) {
  const { collectedAt, ...receiptData } = input.data
  const email = await buildPaymentReceiptEmail({
    ...receiptData,
    paymentDate: formatPaymentDate(collectedAt),
  })
  const notificationRecipients = resolveOutboundNotificationRecipients([input.receiptEmail])

  await input.payload.sendEmail({
    to: notificationRecipients.recipients,
    from: input.payload.email.defaultFromAddress,
    subject: prefixNonLiveEmailSubject(email.subject),
    html: email.html,
  })

  return notificationRecipients
}
