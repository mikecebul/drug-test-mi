import type { Payload, TaskConfig } from 'payload'
import { render } from '@react-email/components'
import { createElement } from 'react'
import { confirmationHoldExpired, confirmationRemaining } from './policy'
import { readRelationshipId } from '@/collections/Payments/services/applyPayment'
import { prefixNonLiveEmailSubject, resolveOutboundNotificationRecipients } from '@/lib/email-safety'
import { createAdminAlert } from '@/lib/admin-alerts'
import { baseUrl } from '@/utilities/baseUrl'

export async function sendConfirmationPaidNotification(payload: Payload, testId: string, notificationKey: string) {
  const test = await payload.findByID({ collection: 'drug-tests', id: testId, depth: 1, overrideAccess: true })
  if (
    test.confirmationPaidNotificationKey !== notificationKey ||
    test.confirmationPaidNotifiedAt ||
    confirmationRemaining(test) > 0
  )
    return
  const adminId = readRelationshipId(test.confirmationNotificationAdmin)
  if (!adminId) throw new Error('Confirmation payment notification has no super-admin recipient.')
  const admin = await payload.findByID({ collection: 'admins', id: adminId, overrideAccess: true, depth: 0 })
  if (admin.role !== 'superAdmin' || !admin.email)
    throw new Error('Confirmation notification recipient is no longer a super admin.')
  const client = typeof test.relatedClient === 'object' ? test.relatedClient : null
  const message = confirmationHoldExpired(test)
    ? 'Confirmation payment received after the laboratory hold ended. Contact the lab before requesting confirmation; review for a refund if the sample is unavailable.'
    : 'Confirmation payment received. Request confirmation in ToxAccess after reviewing the screening report.'
  const html = await render(
    createElement(
      'div',
      null,
      createElement('h2', null, 'Confirmation payment received'),
      createElement('p', null, client ? `${client.firstName} ${client.lastName}` : 'Drug test'),
      createElement('p', null, message),
      createElement('a', { href: `${baseUrl}/admin/collections/drug-tests/${test.id}/summary` }, 'Review test'),
    ),
  )
  const recipients = resolveOutboundNotificationRecipients([admin.email])
  await payload.sendEmail({
    to: recipients.recipients,
    subject: prefixNonLiveEmailSubject('Confirmation payment received'),
    html,
  })
  await payload.update({
    collection: 'drug-tests',
    id: test.id,
    overrideAccess: true,
    data: { confirmationPaidNotifiedAt: new Date().toISOString() },
  })
}

export const notifyConfirmationPaidTask: TaskConfig<'notify-confirmation-paid'> = {
  slug: 'notify-confirmation-paid',
  retries: { attempts: 3, backoff: { delay: 60_000, type: 'exponential' } },
  onFail: async ({ req, job, input, taskStatus }) => {
    if ((taskStatus?.totalTried || 0) < 3) return
    await createAdminAlert(req.payload, {
      severity: 'high',
      alertType: 'email-failure',
      title: 'Confirmation payment notification failed',
      message:
        'Confirmation payment was recorded, but the super-admin email could not be delivered after retries. Review the paid test and retry the notification job.',
      context: { jobId: job.id, ...input },
    })
  },
  inputSchema: [
    { name: 'testId', type: 'text', required: true },
    { name: 'notificationKey', type: 'text', required: true },
  ],
  handler: async ({ input, req }) => {
    await sendConfirmationPaidNotification(req.payload, input.testId, input.notificationKey)
    return { output: {} }
  },
}
