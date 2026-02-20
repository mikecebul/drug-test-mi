'use server'

import { getPayload } from 'payload'
import config from '@payload-config'
import type { FormValues } from '../validators'
import { formatMiddleInitial, formatPersonName, formatPhoneNumber } from '@/lib/client-utils'
import { buildContactsFromLegacyInput, createInactiveReferralAndAlert, parseRecipientEmails } from '@/lib/referrals'

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

export async function registerClientAction(formData: FormValues): Promise<{
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
    const submittedEmail = accountInfo.email.trim().toLowerCase()

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

    const clientData: Record<string, unknown> = {
      firstName: formattedFirstName,
      lastName: formattedLastName,
      ...(formattedMiddleInitial && { middleInitial: formattedMiddleInitial }),
      email: clientEmail,
      password: accountInfo.password,
      gender: personalInfo.gender,
      dob: personalInfo.dob,
      phone: formattedPhone,
      referralType: screeningType.requestedBy,
      preferredContactMethod: noEmail ? 'phone' : 'email',
      disableClientEmails: noEmail,
      _verified: true,
    }

    if (screeningType.requestedBy === 'self') {
      clientData.selfReferral = {
        sendToOther: recipients.sendToOther === true,
        recipients:
          recipients.sendToOther === true
            ? (recipients.selfRecipients || []).filter((recipient): recipient is { name: string; email: string } => Boolean(recipient.name?.trim() && recipient.email?.trim())).map((recipient) => ({ name: recipient.name.trim(), email: recipient.email.trim() }))
            : [],
      }
    }

    if (screeningType.requestedBy === 'employer') {
      if (recipients.selectedEmployer === 'other') {
        const relationship = await createInactiveReferralAndAlert({
          payload,
          type: 'employer',
          source: 'admin',
          name: (recipients.otherEmployerName || '').trim(),
          contacts: buildContactsFromLegacyInput(
            (recipients.otherEmployerMainContactName || '').trim(),
            (recipients.otherEmployerMainContactEmail || '').trim(),
            parseRecipientEmails(recipients.otherEmployerRecipientEmails),
          ),
        })

        clientData.referral = relationship
      } else if (recipients.selectedEmployer) {
        clientData.referral = {
          relationTo: 'employers',
          value: recipients.selectedEmployer,
        }
      }
    }

    if (screeningType.requestedBy === 'court') {
      if (recipients.selectedCourt === 'other') {
        const relationship = await createInactiveReferralAndAlert({
          payload,
          type: 'court',
          source: 'admin',
          name: (recipients.otherCourtName || '').trim(),
          contacts: buildContactsFromLegacyInput(
            (recipients.otherCourtMainContactName || '').trim(),
            (recipients.otherCourtMainContactEmail || '').trim(),
            parseRecipientEmails(recipients.otherCourtRecipientEmails),
          ),
        })

        clientData.referral = relationship
      } else if (recipients.selectedCourt) {
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
