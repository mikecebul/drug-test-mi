import { render } from '@react-email/components'
import {
  CollectedEmail,
  ScreenedEmail,
  ScreenedEmailReferral,
  CompleteEmail,
  CompleteEmailReferral,
  InconclusiveEmail,
  InconclusiveEmailReferral,
} from '@/emails/drug-tests'
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
 * Returns separate emails for client and referrals
 */
export async function buildScreenedEmail(data: ScreenedEmailData): Promise<EmailOutput> {
  const clientHtml = await render(<ScreenedEmail {...data} />)
  const referralHtml = await render(<ScreenedEmailReferral {...data} />)

  return {
    client: {
      subject: `Drug Test Results - ${data.clientName}`,
      html: clientHtml,
    },
    referrals: {
      subject: `Drug Test Results - ${data.clientName}`,
      html: referralHtml,
    },
  }
}

/**
 * Build Complete Email
 * Sent when all confirmation testing is complete
 * Returns separate emails for client and referrals
 */
export async function buildCompleteEmail(data: CompleteEmailData): Promise<EmailOutput> {
  const clientHtml = await render(<CompleteEmail {...data} />)
  const referralHtml = await render(<CompleteEmailReferral {...data} />)

  return {
    client: {
      subject: `Final Drug Test Results - ${data.clientName}`,
      html: clientHtml,
    },
    referrals: {
      subject: `Final Drug Test Results - ${data.clientName}`,
      html: referralHtml,
    },
  }
}

/**
 * Build Inconclusive Email
 * Sent when a test sample is invalid and cannot be screened
 * Returns separate emails for client and referrals
 */
export async function buildInconclusiveEmail(data: InconclusiveEmailData): Promise<EmailOutput> {
  const clientHtml = await render(<InconclusiveEmail {...data} />)
  const referralHtml = await render(<InconclusiveEmailReferral {...data} />)

  return {
    client: {
      subject: `Drug Test - Inconclusive Result - ${data.clientName}`,
      html: clientHtml,
    },
    referrals: {
      subject: `Drug Test - Inconclusive Result - ${data.clientName}`,
      html: referralHtml,
    },
  }
}
