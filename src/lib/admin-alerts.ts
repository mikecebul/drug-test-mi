import type { Payload } from 'payload'

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
        resolved: false,
      },
    })

    payload.logger.info(`Admin alert created: ${params.title}`)
  } catch (error) {
    // If alert creation fails, at least log it
    // Don't throw - we don't want alert failures to crash the main operation
    payload.logger.error('Failed to create admin alert:', error)
    payload.logger.error('Original alert details:', params)
  }
}
