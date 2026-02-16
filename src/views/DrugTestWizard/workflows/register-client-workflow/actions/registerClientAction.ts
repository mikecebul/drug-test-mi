'use server'

import { getPayload } from 'payload'
import config from '@payload-config'
import type { FormValues } from '../validators'
import { formatMiddleInitial, formatPersonName, formatPhoneNumber } from '@/lib/client-utils'
import {
  COURT_CONFIGS,
  EMPLOYER_CONFIGS,
  isValidCourtType,
  isValidEmployerType,
} from '@/app/(frontend)/register/configs/recipient-configs'

const PLACEHOLDER_EMAIL_DOMAIN = 'midrugtest.com'
const PLACEHOLDER_EMAIL_MAX_ATTEMPTS = 5000

function toEmailSlug(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, '')
}

async function generatePlaceholderEmail(payload: Awaited<ReturnType<typeof getPayload>>, firstName: string, lastName: string) {
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
      // Check if email already exists
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

    // Build client data
    const clientData: any = {
      firstName: formattedFirstName,
      lastName: formattedLastName,
      ...(formattedMiddleInitial && { middleInitial: formattedMiddleInitial }),
      email: clientEmail,
      password: accountInfo.password, // Use password from form (could be auto-generated or custom)
      gender: personalInfo.gender,
      dob: personalInfo.dob,
      phone: formattedPhone,
      clientType: screeningType.requestedBy,
      preferredContactMethod: noEmail ? 'phone' : 'email',
      disableClientEmails: noEmail,
      _verified: true, // Auto-verify admin-created clients
    }

    // Add type-specific recipient info
    const requestedBy = screeningType.requestedBy
    if (requestedBy === 'probation') {
      const court = isValidCourtType(recipients.selectedCourt) ? recipients.selectedCourt : null
      if (court && court !== 'other') {
        const config = COURT_CONFIGS[court]
        clientData.courtInfo = {
          courtName: config.label,
          recipients: [...config.recipients],
        }
      } else if (recipients.selectedCourt === 'other') {
        clientData.courtInfo = {
          courtName: recipients.courtName,
          recipients: [
            {
              name: recipients.probationOfficerName,
              email: recipients.probationOfficerEmail,
            },
          ],
        }
      }
    } else if (requestedBy === 'employment') {
      const employer = isValidEmployerType(recipients.selectedEmployer)
        ? recipients.selectedEmployer
        : null
      if (employer && employer !== 'other') {
        const config = EMPLOYER_CONFIGS[employer]
        clientData.employmentInfo = {
          employerName: config.label,
          recipients: [...config.recipients],
        }
      } else if (recipients.selectedEmployer === 'other') {
        clientData.employmentInfo = {
          employerName: recipients.employerName,
          recipients: [{ name: recipients.contactName, email: recipients.contactEmail }],
        }
      }
    } else if (requestedBy === 'self' && !recipients.useSelfAsRecipient) {
      clientData.selfInfo = {
        recipients: [
          {
            name: recipients.alternativeRecipientName,
            email: recipients.alternativeRecipientEmail,
          },
        ],
      }
    }

    // Create the client
    const newClient = await payload.create({
      collection: 'clients',
      data: clientData,
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
