import type { CollectionAfterChangeHook } from 'payload'
import { buildNewClientRegistrationEmail } from '@/emails/clients'
import { formatClientGender } from '@/lib/client-gender'
import { APP_TIMEZONE, parseDob } from '@/lib/date-utils'
import { prefixNonLiveEmailSubject, resolveOutboundNotificationRecipients } from '@/lib/email-safety'
import { getServerSideURL } from '@/utilities/getURL'
import { resolveRegistrationReferral } from './registrationNotification'

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(typeof error === 'string' ? error : String(error))
}

function formatDateOfBirth(value: unknown): string | undefined {
  if (typeof value !== 'string' && !(value instanceof Date)) return undefined
  const date = parseDob(value)
  if (!date) return undefined

  return date.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function formatRegistrationTime(value: unknown): string {
  const date = typeof value === 'string' || value instanceof Date ? new Date(value) : new Date()
  const validDate = Number.isNaN(date.getTime()) ? new Date() : date

  return `${new Intl.DateTimeFormat('en-US', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: APP_TIMEZONE,
  }).format(validDate)} ET`
}

export const notifyNewRegistration: CollectionAfterChangeHook = async ({ doc, operation, req }) => {
  if (operation !== 'create' || req.user) return doc

  const { payload } = req

  try {
    const referral = await resolveRegistrationReferral({ doc, payload })
    const clientName = [doc.firstName, doc.lastName].filter(Boolean).join(' ') || doc.email
    const email = await buildNewClientRegistrationEmail({
      adminUrl: `${getServerSideURL()}/admin/collections/clients/${doc.id}`,
      clientName,
      dateOfBirth: formatDateOfBirth(doc.dob),
      email: doc.email,
      gender: doc.gender ? formatClientGender(doc.gender) : undefined,
      phone: doc.phone || undefined,
      recipients: referral.recipients,
      referralName: referral.referralName,
      referralType: referral.referralTypeName,
      registeredAt: formatRegistrationTime(doc.createdAt),
    })

    try {
      const notificationRecipients = resolveOutboundNotificationRecipients([
        'mike@midrugtest.com',
        'tom@midrugtest.com',
      ])

      await payload.sendEmail({
        to: notificationRecipients.recipients,
        from: payload.email.defaultFromAddress,
        subject: prefixNonLiveEmailSubject(email.subject),
        html: email.html,
      })

      payload.logger.info({
        msg: 'New registration notification sent',
        clientEmail: doc.email,
        referralName: referral.referralName,
        recipients: notificationRecipients.recipients,
        originalRecipients: notificationRecipients.originalRecipients,
        redirected: notificationRecipients.redirected,
      })
    } catch (error) {
      payload.logger.warn({
        msg: 'Failed to send registration notification email (non-blocking)',
        err: toError(error),
      })
    }
  } catch (error) {
    payload.logger.error({
      msg: 'Unexpected failure while preparing registration notification',
      err: toError(error),
    })
  }

  return doc
}
