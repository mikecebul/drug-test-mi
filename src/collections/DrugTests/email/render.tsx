import { render } from '@react-email/components'
import { CollectedEmail, ScreenedEmail, CompleteEmail, InconclusiveEmail } from '@/emails/drug-tests'
import type {
  CollectedEmailData,
  ScreenedEmailData,
  CompleteEmailData,
  InconclusiveEmailData,
  EmailOutput,
} from './types'

/**
 * Build Collected Email (Referrals Only)
 * Sent when a lab test sample is collected and sent to the lab
 */
export async function buildCollectedEmail(data: CollectedEmailData): Promise<{
  subject: string
  html: string
}> {
  const html = await render(<CollectedEmail {...data} />)
  return {
    subject: `Drug Test Sample Collected - ${data.clientName}`,
    html,
  }
}

/**
 * Build Screened Email
 * Sent when initial screening results are entered
 * The same content is used for client and referral recipients.
 */
export async function buildScreenedEmail(data: ScreenedEmailData): Promise<EmailOutput> {
  const deadline = data.confirmationHoldUntil ? new Date(data.confirmationHoldUntil).getTime() : NaN
  const confirmationWindowClosed = Number.isFinite(deadline) && deadline <= Date.now()
  const html = await render(<ScreenedEmail {...data} confirmationWindowClosed={confirmationWindowClosed} />)

  return {
    client: {
      subject: `Drug Test Results - ${data.clientName}`,
      html,
    },
    referrals: {
      subject: `Drug Test Results - ${data.clientName}`,
      html,
    },
  }
}

/**
 * Build Complete Email
 * Sent when all confirmation testing is complete
 * The same content is used for client and referral recipients.
 */
export async function buildCompleteEmail(data: CompleteEmailData): Promise<EmailOutput> {
  const html = await render(<CompleteEmail {...data} />)

  return {
    client: {
      subject: `Final Drug Test Results - ${data.clientName}`,
      html,
    },
    referrals: {
      subject: `Final Drug Test Results - ${data.clientName}`,
      html,
    },
  }
}

/**
 * Build Inconclusive Email
 * Sent when a test sample is invalid and cannot be screened
 * The same content is used for client and referral recipients.
 */
export async function buildInconclusiveEmail(data: InconclusiveEmailData): Promise<EmailOutput> {
  const html = await render(<InconclusiveEmail {...data} />)

  return {
    client: {
      subject: `Drug Test - Inconclusive Result - ${data.clientName}`,
      html,
    },
    referrals: {
      subject: `Drug Test - Inconclusive Result - ${data.clientName}`,
      html,
    },
  }
}
