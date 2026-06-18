'use server'

import { getPayload } from 'payload'
import config from '@payload-config'
import type { CompleteRegistrationValues } from '../validators'
import { formatMiddleInitial, formatPersonName, formatPhoneNumber } from '@/lib/client-utils'
import {
  assertReferralHasContacts,
  buildContactsFromLegacyInput,
  createInactiveReferralAndAlert,
  normalizeReferralContacts,
  parseRecipientEmails,
} from '@/lib/referrals'

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

const PLACEHOLDER_EMAIL_DOMAIN = 'midrugtest.com'
const PLACEHOLDER_EMAIL_MAX_ATTEMPTS = 5000

function toEmailSlug(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, '')
}

async function generatePlaceholderEmail(
  payload: Awaited<ReturnType<typeof getPayload>>,
  firstName: string,
  lastName: string,
) {
  const firstSlug = toEmailSlug(firstName) || 'client'
  const lastSlug = toEmailSlug(lastName) || 'profile'
  const emailBase = `${firstSlug}.${lastSlug}`

  for (let increment = 1; increment <= PLACEHOLDER_EMAIL_MAX_ATTEMPTS; increment++) {
    const candidateEmail = `${emailBase}${increment}@${PLACEHOLDER_EMAIL_DOMAIN}`
    const existingClient = await payload.find({
      collection: 'clients',
      where: { email: { equals: candidateEmail } },
      limit: 1,
      overrideAccess: true,
    })

    if (existingClient.docs.length === 0) {
      return candidateEmail
    }
  }

  throw new Error(
    `Unable to generate a unique placeholder email for ${emailBase}@${PLACEHOLDER_EMAIL_DOMAIN}. Tried ${PLACEHOLDER_EMAIL_MAX_ATTEMPTS} candidates.`,
  )
}

export async function registerClientAction(formData: CompleteRegistrationValues): Promise<{
  success: boolean
  clientId?: string
  clientFirstName?: string
  clientLastName?: string
  clientEmail?: string
  error?: string
}> {
  const payload = await getPayload({ config })

  try {
    const { personalInfo, accountInfo, screeningType, recipients } = formData
    const formattedFirstName = formatPersonName(personalInfo.firstName)
    const formattedLastName = formatPersonName(personalInfo.lastName)
    const formattedMiddleInitial = formatMiddleInitial(personalInfo.middleInitial)
    const formattedPhone = formatPhoneNumber(personalInfo.phone)
    const noEmail = accountInfo.noEmail === true
    const submittedEmail = (accountInfo.email ?? '').trim().toLowerCase()
    const submittedPassword = accountInfo.password

    if (!submittedPassword) {
      throw new Error('Password is required.')
    }

    if (!noEmail && !submittedEmail) {
      throw new Error('Email is required.')
    }

    const clientEmail = noEmail
      ? await generatePlaceholderEmail(payload, formattedFirstName, formattedLastName)
      : submittedEmail

    if (!noEmail) {
      const existingClient = await payload.find({
        collection: 'clients',
        where: { email: { equals: clientEmail } },
        limit: 1,
        overrideAccess: true,
      })

      if (existingClient.docs.length > 0) {
        return {
          success: false,
          error: 'A client with this email already exists.',
        }
      }
    }

    const duplicateClient = await payload.find({
      collection: 'clients',
      where: {
        or: [
          {
            and: [
              {
                firstName: {
                  equals: formattedFirstName,
                },
              },
              {
                lastName: {
                  equals: formattedLastName,
                },
              },
              {
                dob: {
                  equals: personalInfo.dob,
                },
              },
            ],
          },
          {
            phone: {
              equals: formattedPhone,
            },
          },
        ],
      },
      limit: 1,
      overrideAccess: true,
    })

    if (duplicateClient.docs.length > 0) {
      return {
        success: false,
        error:
          'A likely matching client already exists. Return to the scheduled collection screen and select the existing client instead of registering a new one.',
      }
    }

    const clientData: Record<string, unknown> = {
      firstName: formattedFirstName,
      lastName: formattedLastName,
      ...(formattedMiddleInitial && { middleInitial: formattedMiddleInitial }),
      email: clientEmail,
      password: submittedPassword,
      gender: personalInfo.gender,
      dob: personalInfo.dob,
      phone: formattedPhone,
      referralType: screeningType.requestedBy,
      preferredContactMethod: noEmail ? 'phone' : 'email',
      disableClientEmails: noEmail,
      _verified: true,
    }

    if (screeningType.requestedBy === 'self') {
      clientData.referralAdditionalRecipients = normalizeAdditionalRecipients(recipients.additionalReferralRecipients)
    }

    if (screeningType.requestedBy === 'employer') {
      clientData.referralAdditionalRecipients = normalizeAdditionalRecipients(recipients.additionalReferralRecipients)

      if (recipients.selectedEmployer === 'other') {
        const relationship = await createInactiveReferralAndAlert({
          payload,
          type: 'employer',
          source: 'admin',
          name: (recipients.otherEmployerName || '').trim(),
          contacts: buildReferralContactsFromForm({
            mainContactName: (recipients.otherEmployerMainContactName || '').trim(),
            mainContactEmail: (recipients.otherEmployerMainContactEmail || '').trim(),
            namedAdditionalRecipients: recipients.otherEmployerAdditionalRecipients,
            legacyAdditionalRecipientEmails: recipients.otherEmployerRecipientEmails,
          }),
        })

        clientData.referral = relationship
      } else if (recipients.selectedEmployer) {
        await assertReferralHasContacts({
          payload,
          relationTo: 'employers',
          referralId: recipients.selectedEmployer,
        })

        clientData.referral = {
          relationTo: 'employers',
          value: recipients.selectedEmployer,
        }
      }
    }

    if (screeningType.requestedBy === 'court') {
      clientData.referralAdditionalRecipients = normalizeAdditionalRecipients(recipients.additionalReferralRecipients)

      if (recipients.selectedCourt === 'other') {
        const relationship = await createInactiveReferralAndAlert({
          payload,
          type: 'court',
          source: 'admin',
          name: (recipients.otherCourtName || '').trim(),
          contacts: buildReferralContactsFromForm({
            mainContactName: (recipients.otherCourtMainContactName || '').trim(),
            mainContactEmail: (recipients.otherCourtMainContactEmail || '').trim(),
            namedAdditionalRecipients: recipients.otherCourtAdditionalRecipients,
            legacyAdditionalRecipientEmails: recipients.otherCourtRecipientEmails,
          }),
        })

        clientData.referral = relationship
      } else if (recipients.selectedCourt) {
        await assertReferralHasContacts({
          payload,
          relationTo: 'courts',
          referralId: recipients.selectedCourt,
        })

        clientData.referral = {
          relationTo: 'courts',
          value: recipients.selectedCourt,
        }
      }
    }

    const newClient = await payload.create({
      collection: 'clients',
      data: clientData as any,
      overrideAccess: true,
    })

    payload.logger.info(`[registerClientAction] Created client ${newClient.id} for ${newClient.email}`)

    return {
      success: true,
      clientId: newClient.id,
      clientFirstName: newClient.firstName,
      clientLastName: newClient.lastName,
      clientEmail: newClient.email,
    }
  } catch (error) {
    payload.logger.error('[registerClientAction] Error:', error)
    return {
      success: false,
      error: `Failed to register client: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}
