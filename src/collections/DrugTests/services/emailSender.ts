import type { Payload } from 'payload'
import { createAdminAlert } from '@/lib/admin-alerts'

const TEST_MODE = process.env.EMAIL_TEST_MODE === 'true'
const TEST_EMAIL = 'mike@midrugtest.com'
const DRUG_TEST_FROM_EMAIL = 'mike@midrugtest.com'

// Rate limiting: 2 requests per second max, so we use 600ms delay to be safe
const EMAIL_SEND_DELAY_MS = 600

/**
 * Delay helper to prevent rate limiting
 */
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export type EmailContent = {
  subject: string
  html: string
}

export type EmailAttachment = {
  filename: string
  content: Buffer
  contentType: string
}

export type SendEmailsParams = {
  payload: Payload
  clientEmail?: string | null
  clientEmailData?: EmailContent | null
  referralEmails: string[]
  referralEmailData: EmailContent
  attachment?: EmailAttachment
  emailStage: 'collected' | 'screened' | 'complete' | 'inconclusive'
  drugTestId: string
  clientId: string
  clientName: string
}

export type SendEmailsResult = {
  sentTo: string[]
  failedRecipients: string[]
}

/**
 * Sends emails to client and referrals with optional PDF attachment
 *
 * Features:
 * - TEST_MODE support (redirects all emails to test address)
 * - Separate content for client vs referrals
 * - Optional PDF attachment
 * - Individual error handling per recipient
 * - Admin alerts on referral email failures
 * - Client deduplication for "self" clients
 *
 * @param params - Email recipients, content, attachment, and metadata
 * @returns List of successful and failed recipients
 */
export async function sendEmails(params: SendEmailsParams): Promise<SendEmailsResult> {
  const {
    payload,
    clientEmail,
    clientEmailData,
    referralEmails,
    referralEmailData,
    attachment,
    emailStage,
    drugTestId,
    clientId,
    clientName,
  } = params

  const sentTo: string[] = []
  const failedRecipients: string[] = []

  // Send to client (if applicable)
  // For "collected" stage: skip client (only notify referrals)
  // For "self" clients: skip if client email already in referral list (prevent duplicate)
  if (emailStage !== 'collected' && clientEmailData && clientEmail) {
    const isClientInReferralList = referralEmails.includes(clientEmail)

    if (!isClientInReferralList) {
      const toAddress = TEST_MODE ? TEST_EMAIL : clientEmail

      try {
        await payload.sendEmail({
          to: toAddress,
          from: DRUG_TEST_FROM_EMAIL,
          subject: TEST_MODE ? `[TEST MODE] ${clientEmailData.subject}` : clientEmailData.subject,
          html: clientEmailData.html,
          attachments: attachment
            ? [
                {
                  filename: attachment.filename,
                  content: attachment.content,
                  contentType: attachment.contentType,
                },
              ]
            : undefined,
        })

        sentTo.push(`Client: ${toAddress}${TEST_MODE ? ' (TEST MODE)' : ''}`)
        payload.logger.info(`Successfully sent ${emailStage} email to client ${toAddress}`)

        // Delay before sending referral emails to prevent rate limiting
        await delay(EMAIL_SEND_DELAY_MS)
      } catch (emailError) {
        const errorMessage = emailError instanceof Error ? emailError.message : String(emailError)
        const smtpCode = (emailError as any)?.responseCode || (emailError as any)?.code

        payload.logger.error({
          msg: 'Failed to send email to client',
          recipient: toAddress,
          emailStage,
          error: emailError,
          errorMessage,
          smtpCode,
          isTransient: smtpCode ? smtpCode >= 400 && smtpCode < 500 : false,
        })

        failedRecipients.push(toAddress)

        // CRITICAL: Alert admin when client email fails (not just referrals)
        await createAdminAlert(payload, {
          severity: 'high',
          alertType: 'email-failure',
          title: `Client email failed - ${clientName}`,
          message: `Failed to send ${emailStage} results email${attachment ? ' with attachment' : ''} to client.\n\nClient: ${clientName}\nClient Email: ${toAddress}\nStage: ${emailStage}\nDrug Test ID: ${drugTestId}${attachment ? `\nDocument: ${attachment.filename}` : ''}${smtpCode ? `\nSMTP Code: ${smtpCode}` : ''}\nError: ${errorMessage}\n\nPlease send results manually or investigate email configuration.`,
          context: {
            drugTestId,
            clientId,
            clientName,
            recipientEmail: toAddress,
            recipientType: 'client',
            emailStage,
            documentFilename: attachment?.filename,
            smtpCode,
            errorMessage,
            errorStack: emailError instanceof Error ? emailError.stack : undefined,
          },
        })

        // Delay even after failed send to prevent rate limiting on retry
        await delay(EMAIL_SEND_DELAY_MS)
      }
    } else {
      payload.logger.info(`Skipping separate client email for ${clientEmail} - already in referral list (self client)`)
    }
  }

  // Send to referrals
  if (referralEmailData && referralEmails.length > 0) {
    const recipients = TEST_MODE ? [TEST_EMAIL] : referralEmails

    payload.logger.info(`Sending ${emailStage} email to ${recipients.length} referral(s)`)

    for (const email of recipients) {
      try {
        await payload.sendEmail({
          to: email,
          from: DRUG_TEST_FROM_EMAIL,
          subject: TEST_MODE ? `[TEST MODE] ${referralEmailData.subject}` : referralEmailData.subject,
          html: referralEmailData.html,
          attachments: attachment
            ? [
                {
                  filename: attachment.filename,
                  content: attachment.content,
                  contentType: attachment.contentType,
                },
              ]
            : undefined,
        })

        sentTo.push(`Referral: ${email}${TEST_MODE ? ' (TEST MODE)' : ''}`)
        payload.logger.info(`Successfully sent ${emailStage} email to referral ${email}`)

        // Delay between each referral email to prevent rate limiting
        await delay(EMAIL_SEND_DELAY_MS)
      } catch (emailError) {
        const errorMessage = emailError instanceof Error ? emailError.message : String(emailError)
        const smtpCode = (emailError as any)?.responseCode || (emailError as any)?.code

        payload.logger.error({
          msg: 'Failed to send email to referral',
          recipient: email,
          emailStage,
          error: emailError,
          errorMessage,
          smtpCode,
          isTransient: smtpCode ? smtpCode >= 400 && smtpCode < 500 : false,
        })

        failedRecipients.push(email)

        // CRITICAL: Alert admin immediately when referral email fails
        await createAdminAlert(payload, {
          severity: 'critical',
          alertType: 'email-failure',
          title: `Referral email failed - ${clientName}`,
          message: `URGENT: Failed to send ${emailStage} results email${attachment ? ' with attachment' : ''} to referral.\n\nIMMEDIATE ACTION REQUIRED: Manually send results to this referral.\n\nClient: ${clientName}\nReferral Email: ${email}\nStage: ${emailStage}\nDrug Test ID: ${drugTestId}${attachment ? `\nDocument: ${attachment.filename}` : ''}${smtpCode ? `\nSMTP Code: ${smtpCode}` : ''}\nError: ${errorMessage}\n\nThis referral is expecting these results${attachment ? ' with the test report PDF' : ''}. Please send manually ASAP.`,
          context: {
            drugTestId,
            clientId,
            clientName,
            recipientEmail: email,
            recipientType: 'referral',
            emailStage,
            documentFilename: attachment?.filename,
            smtpCode,
            errorMessage,
            errorStack: emailError instanceof Error ? emailError.stack : undefined,
          },
        })

        // Delay even after failed send to prevent rate limiting on retry
        await delay(EMAIL_SEND_DELAY_MS)
      }
    }

    payload.logger.info(`Completed sending ${emailStage} emails to referrals`)
  } else {
    payload.logger.warn(
      `${emailStage} email to referrals NOT sent - referralEmailData: ${!!referralEmailData}, referralEmails.length: ${referralEmails.length}`,
    )
  }

  return { sentTo, failedRecipients }
}
