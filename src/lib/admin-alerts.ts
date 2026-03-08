import type { Payload } from 'payload'
import type { RedwoodJobType } from '@/lib/redwood/incidents'

export type AlertSeverity = 'critical' | 'high' | 'medium'
export type AlertType =
  | 'email-failure'
  | 'recipient-fetch-failure'
  | 'document-missing'
  | 'notification-history-failure'
  | 'data-integrity'
  | 'other'

export interface CreateAdminAlertParams {
  severity: AlertSeverity
  alertType: AlertType
  title: string
  message: string
  context?: Record<string, any>
  client?: string
  dedupeKey?: string
  jobType?: RedwoodJobType
  statusSnapshot?: Record<string, unknown> | null
  screenshotPath?: string | null
  attemptCount?: number
  lastSeenAt?: string
  recommendedAction?: string
}

/**
 * Create an admin alert for business-critical failures
 *
 * Use this for issues that require immediate admin attention:
 * - Email send failures (especially to referrals)
 * - Recipient fetch failures
 * - Missing documents when needed for emails
 * - Notification history update failures
 * - Data integrity issues
 *
 * Lower-priority errors should be tracked in Sentry/Glitchtip only.
 *
 * @example
 * await createAdminAlert(payload, {
 *   severity: 'critical',
 *   alertType: 'email-failure',
 *   title: 'Referral email failed for John Doe',
 *   message: 'Failed to send screened results email to referral officer@court.gov',
 *   context: {
 *     drugTestId: 'test-123',
 *     clientId: 'client-456',
 *     recipientEmail: 'officer@court.gov',
 *     error: error.message,
 *   },
 * })
 */
export async function createAdminAlert(
  payload: Payload,
  params: CreateAdminAlertParams,
): Promise<void> {
  try {
    await payload.create({
      collection: 'admin-alerts',
      data: {
        title: params.title,
        severity: params.severity,
        alertType: params.alertType,
        message: params.message,
        context: params.context,
        client: params.client,
        dedupeKey: params.dedupeKey,
        jobType: params.jobType,
        statusSnapshot: params.statusSnapshot,
        screenshotPath: params.screenshotPath,
        attemptCount: params.attemptCount,
        lastSeenAt: params.lastSeenAt,
        recommendedAction: params.recommendedAction,
        resolved: false,
      },
      overrideAccess: true,
    })

    payload.logger.info({
      msg: '[admin-alerts] Admin alert created',
      title: params.title,
      alertType: params.alertType,
      dedupeKey: params.dedupeKey || null,
    })
  } catch (error) {
    payload.logger.error({
      msg: '[admin-alerts] Failed to create admin alert',
      error: error instanceof Error ? error.message : String(error),
      params,
    })
  }
}
