import type { Payload } from 'payload'
import { getRecipients } from '../email/recipients'
import { fetchClientHeadshot } from '../email/fetch-headshot'
import {
  buildCollectedEmail,
  buildScreenedEmail,
  buildCompleteEmail,
  buildInconclusiveEmail,
} from '../email/render'
import type { ConfirmationResult } from './testResults'

export type EmailStage = 'collected' | 'screened' | 'complete' | 'inconclusive'

export type EmailDataResult = {
  clientEmail: string
  referralEmails: string[]
  clientEmailData: { subject: string; html: string } | null
  referralEmailData: { subject: string; html: string }
}

/**
 * Fetches recipients (client email + referral emails) for a drug test
 *
 * @param clientId - The client ID
 * @param payload - Payload instance
 * @returns Object with clientEmail and referralEmails array
 */
export async function fetchRecipients(
  clientId: string,
  payload: Payload,
): Promise<{ clientEmail: string; referralEmails: string[] }> {
  return await getRecipients(clientId, payload)
}

/**
 * Fetches client headshot and converts to Base64 data URI for email embedding
 *
 * @param clientId - The client ID
 * @param payload - Payload instance
 * @returns Base64 data URI or null if no headshot
 */
export async function fetchHeadshot(clientId: string, payload: Payload): Promise<string | null> {
  return await fetchClientHeadshot(clientId, payload)
}

/**
 * Fetches client data for email templates
 *
 * @param clientId - The client ID
 * @param payload - Payload instance
 * @returns Client object with name and dob
 */
export async function fetchClientData(
  clientId: string,
  payload: Payload,
): Promise<{ name: string; dob: string | null }> {
  const client = await payload.findByID({
    collection: 'clients',
    id: clientId,
    depth: 0,
  })

  if (!client) {
    throw new Error(`Client not found: ${clientId}`)
  }

  return {
    name: `${client.firstName} ${client.lastName}`,
    dob: client.dob || null,
  }
}

/**
 * Builds collected email (sample collected, sent to lab)
 * Only sends to referrals - client doesn't need notification at this stage
 */
export async function buildCollectedEmailData(params: {
  clientName: string
  collectionDate: string
  testType: string
  breathalyzerTaken: boolean
  breathalyzerResult: number | null
  clientHeadshotDataUri?: string | null
  clientDob?: string | null
}): Promise<{ subject: string; html: string }> {
  return await buildCollectedEmail(params)
}

/**
 * Builds screened email (initial screening results available)
 * Sends different content to client vs referrals
 */
export async function buildScreenedEmailData(params: {
  clientName: string
  collectionDate: string
  testType: string
  initialScreenResult: string
  detectedSubstances: string[]
  expectedPositives: string[]
  unexpectedPositives: string[]
  unexpectedNegatives: string[]
  isDilute: boolean
  breathalyzerTaken: boolean
  breathalyzerResult: number | null
  confirmationDecision?: 'accept' | 'request-confirmation' | 'pending-decision' | null
  clientHeadshotDataUri?: string | null
  clientDob?: string | null
}): Promise<{ client: { subject: string; html: string }; referrals: { subject: string; html: string } }> {
  return await buildScreenedEmail(params)
}

/**
 * Builds complete email (final results with confirmation testing)
 * Sends different content to client vs referrals
 */
export async function buildCompleteEmailData(params: {
  clientName: string
  collectionDate: string
  testType: string
  initialScreenResult: string
  detectedSubstances: string[]
  expectedPositives: string[]
  unexpectedPositives: string[]
  unexpectedNegatives: string[]
  confirmationResults?: ConfirmationResult[]
  finalStatus: string
  isDilute: boolean
  breathalyzerTaken: boolean
  breathalyzerResult: number | null
  clientHeadshotDataUri?: string | null
  clientDob?: string | null
}): Promise<{ client: { subject: string; html: string }; referrals: { subject: string; html: string } }> {
  return await buildCompleteEmail(params)
}

/**
 * Builds inconclusive email (sample invalid/cannot be screened)
 * Sends different content to client vs referrals
 */
export async function buildInconclusiveEmailData(params: {
  clientName: string
  collectionDate: string
  testType: string
  breathalyzerTaken: boolean
  breathalyzerResult: number | null
  reason?: string
  clientHeadshotDataUri?: string | null
  clientDob?: string | null
}): Promise<{ client: { subject: string; html: string }; referrals: { subject: string; html: string } }> {
  return await buildInconclusiveEmail(params)
}
