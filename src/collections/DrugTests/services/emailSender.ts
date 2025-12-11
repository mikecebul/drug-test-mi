import type { Payload } from 'payload'
import { createAdminAlert } from '@/lib/admin-alerts'

const TEST_MODE = process.env.EMAIL_TEST_MODE === 'true'
const TEST_EMAIL = 'mike@midrugtest.com'

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
          from: payload.email.defaultFromAddress,
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
      } catch (emailError) {
        payload.logger.error(`Failed to send email to client ${toAddress}:`, emailError)
        sentTo.push(`Client: ${toAddress} (FAILED)`)
        failedRecipients.push(toAddress)
      }
    } else {
      payload.logger.info(
        `Skipping separate client email for ${clientEmail} - already in referral list (self client)`,
      )
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
          from: payload.email.defaultFromAddress,
          subject: TEST_MODE
            ? `[TEST MODE] ${referralEmailData.subject}`
            : referralEmailData.subject,
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
      } catch (emailError) {
        payload.logger.error(`Failed to send email to referral ${email}:`, emailError)
        sentTo.push(`Referral: ${email} (FAILED)`)
        failedRecipients.push(email)

        // CRITICAL: Alert admin immediately when referral email fails
        await createAdminAlert(payload, {
          severity: 'critical',
          alertType: 'email-failure',
          title: `Referral email failed - ${clientName}`,
          message: `URGENT: Failed to send ${emailStage} results email${attachment ? ' with attachment' : ''} to referral.\n\nIMMEDIATE ACTION REQUIRED: Manually send results to this referral.\n\nClient: ${clientName}\nReferral Email: ${email}\nStage: ${emailStage}\nDrug Test ID: ${drugTestId}${attachment ? `\nDocument: ${attachment.filename}` : ''}\nError: ${emailError instanceof Error ? emailError.message : String(emailError)}\n\nThis referral is expecting these results${attachment ? ' with the test report PDF' : ''}. Please send manually ASAP.`,
          context: {
            drugTestId,
            clientId,
            clientName,
            recipientEmail: email,
            recipientType: 'referral',
            emailStage,
            documentFilename: attachment?.filename,
            errorMessage: emailError instanceof Error ? emailError.message : String(emailError),
            errorStack: emailError instanceof Error ? emailError.stack : undefined,
          },
        })
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
