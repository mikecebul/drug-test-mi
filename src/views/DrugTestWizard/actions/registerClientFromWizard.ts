'use server'

import { requireWizardAdmin } from '../server/requireWizardAdmin'
import { randomInt } from 'node:crypto'
import type { RequiredDataFromCollectionSlug } from 'payload'
import type { ClientMatch } from '../types'
import { formatMiddleInitial, formatPersonName, formatPhoneNumber } from '@/lib/client-utils'
import { formatRequiredDobISO } from '@/lib/date-utils'
import {
  assertReferralHasContacts,
  buildContactsFromLegacyInput,
  createInactiveReferralAndAlert,
  normalizeReferralContacts,
  parseRecipientEmails,
} from '@/lib/referrals'
import { REDWOOD_PROVISIONING_SOURCE_CONTEXT_KEY } from '@/lib/redwood/context'

/**
 * Generate a secure random password
 * Ensures password meets complexity requirements:
 * - At least 12 characters
 * - Contains uppercase, lowercase, and numbers
 */
function generateSecurePassword(): string {
  const length = 12
  const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ' // Excludes ambiguous: I, O
  const lowercase = 'abcdefghjkmnpqrstuvwxyz' // Excludes ambiguous: i, l, o
  const numbers = '23456789' // Excludes ambiguous: 0, 1

  // Ensure requirements: 1 upper, 1 lower, 1 number
  let password = ''
  password += uppercase[randomInt(uppercase.length)]
  password += lowercase[randomInt(lowercase.length)]
  password += numbers[randomInt(numbers.length)]

  // Fill remaining characters from all pools
  const all = uppercase + lowercase + numbers
  for (let i = 3; i < length; i++) {
    password += all[randomInt(all.length)]
  }

  // Shuffle password to avoid predictable pattern
  const characters = password.split('')
  for (let i = characters.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[characters[i], characters[j]] = [characters[j], characters[i]]
  }
  return characters.join('')
}

function normalizeAdditionalRecipients(
  rows: Array<{ name?: string; email?: string }> | undefined,
): Array<{ name?: string; email: string }> {
  const deduped = new Map<string, { name?: string; email: string }>()

  for (const row of rows || []) {
    const email = row.email?.trim()
    if (!email) continue

    const key = email.toLowerCase()
    const name = row.name?.trim() || undefined
    const existing = deduped.get(key)

    if (!existing) {
      deduped.set(key, { ...(name ? { name } : {}), email })
      continue
    }

    if (!existing.name && name) {
      deduped.set(key, { name, email: existing.email })
    }
  }

  return Array.from(deduped.values())
}

function buildReferralContactsFromForm(args: {
  mainContactName: string
  mainContactEmail: string
  namedAdditionalRecipients?: Array<{ name?: string; email?: string }>
  legacyAdditionalRecipientEmails?: string
}) {
  const namedAdditionalRecipients = normalizeAdditionalRecipients(args.namedAdditionalRecipients)

  if (namedAdditionalRecipients.length > 0) {
    return normalizeReferralContacts([
      { name: args.mainContactName, email: args.mainContactEmail },
      ...namedAdditionalRecipients,
    ])
  }

  return buildContactsFromLegacyInput(
    args.mainContactName,
    args.mainContactEmail,
    parseRecipientEmails(args.legacyAdditionalRecipientEmails),
  )
}

/**
 * Register a new client from the Drug Test Wizard
 * Creates a client with auto-generated password
 */
export async function registerClientFromWizard(data: {
  firstName: string
  lastName: string
  middleInitial?: string
  gender: string
  dob: string
  phone: string
  email: string
  referralType: 'self' | 'employer' | 'court'
  referral?: {
    relationTo: 'courts' | 'employers'
    value: string
  }
  otherReferral?: {
    type: 'court' | 'employer'
    name: string
    mainContactName: string
    mainContactEmail: string
    recipientEmails?: string
    additionalRecipients?: Array<{ name?: string; email?: string }>
  }
  additionalReferralRecipients?: Array<{ name?: string; email: string }>
}): Promise<{
  success: boolean
  client?: ClientMatch
  generatedPassword?: string
  error?: string
}> {
  const { payload } = await requireWizardAdmin()

  try {
    if (data.gender !== 'male' && data.gender !== 'female') return { success: false, error: 'Select a valid gender.' }
    // Check if email already exists
    const existingClient = await payload.find({
      collection: 'clients',
      where: { email: { equals: data.email } },
      limit: 1,
      overrideAccess: true,
    })

    if (existingClient.docs.length > 0) {
      return {
        success: false,
        error: 'A client with this email already exists. Please search for them instead.',
      }
    }

    // Generate a random password
    const generatedPassword = generateSecurePassword()
    const formattedFirstName = formatPersonName(data.firstName)
    const formattedLastName = formatPersonName(data.lastName)
    const formattedMiddleInitial = formatMiddleInitial(data.middleInitial)
    const formattedPhone = formatPhoneNumber(data.phone)
    const formattedDob = formatRequiredDobISO(data.dob)

    // Build client data
    const clientData: RequiredDataFromCollectionSlug<'clients'> = {
      firstName: formattedFirstName,
      lastName: formattedLastName,
      middleInitial: formattedMiddleInitial,
      email: data.email,
      password: generatedPassword,
      gender: data.gender,
      dob: formattedDob,
      phone: formattedPhone,
      referralType: data.referralType,
      preferredContactMethod: 'email',
    }

    clientData.referralAdditionalRecipients = normalizeAdditionalRecipients(data.additionalReferralRecipients)

    if (data.referralType !== 'self' && data.otherReferral) {
      const relationship = await createInactiveReferralAndAlert({
        payload,
        type: data.otherReferral.type,
        source: 'admin',
        name: data.otherReferral.name,
        contacts: buildReferralContactsFromForm({
          mainContactName: data.otherReferral.mainContactName,
          mainContactEmail: data.otherReferral.mainContactEmail,
          namedAdditionalRecipients: data.otherReferral.additionalRecipients,
          legacyAdditionalRecipientEmails: data.otherReferral.recipientEmails,
        }),
      })

      clientData.referral = relationship
    } else if (data.referralType !== 'self' && data.referral) {
      await assertReferralHasContacts({
        payload,
        relationTo: data.referral.relationTo,
        referralId: data.referral.value,
      })

      clientData.referral = data.referral
    }

    // Create the client
    const newClient = await payload.create({
      collection: 'clients',
      data: clientData,
      context: {
        [REDWOOD_PROVISIONING_SOURCE_CONTEXT_KEY]: 'wizard-registration',
      },
      overrideAccess: true,
    })

    payload.logger.info(`[registerClientFromWizard] Created client ${newClient.id} for ${data.email}`)

    // Return client data formatted as ClientMatch
    return {
      success: true,
      client: {
        id: newClient.id,
        firstName: newClient.firstName,
        lastName: newClient.lastName,
        middleInitial: newClient.middleInitial || undefined,
        email: newClient.email,
        dob: newClient.dob,
        headshot: null, // New client won't have a headshot yet
        matchType: 'exact',
        score: 1,
      },
      generatedPassword,
    }
  } catch (error) {
    payload.logger.error('Error registering client from wizard:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to register client',
    }
  }
}
