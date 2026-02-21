'use server'

import { getPayload } from 'payload'
import config from '@payload-config'
import type { FormValues } from './validators'
import { formatMiddleInitial, formatPersonName, formatPhoneNumber } from '@/lib/client-utils'
import { formatDateOnlyISO, getCurrentIsoTimestamp, getTodayDateOnlyISO } from '@/lib/date-utils'
import {
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

export async function checkEmailExists(email: string): Promise<boolean> {
  try {
    const payload = await getPayload({ config })

    const result = await payload.find({
      collection: 'clients',
      where: {
        email: {
          equals: email,
        },
      },
      limit: 1,
    })

    return result.docs.length > 0
  } catch (error) {
    console.error('Error checking email existence:', error)
    return false
  }
}

export async function registerWebsiteClientAction(formData: FormValues): Promise<{
  success: boolean
  error?: string
}> {
  const payload = await getPayload({ config })

  try {
    const { personalInfo, accountInfo, screeningType, recipients, medications } = formData

    const existingClient = await payload.find({
      collection: 'clients',
      where: {
        email: {
          equals: accountInfo.email.trim().toLowerCase(),
        },
      },
      limit: 1,
      overrideAccess: true,
    })

    if (existingClient.docs.length > 0) {
      return {
        success: false,
        error: 'An account with this email already exists. Please sign in instead.',
      }
    }

    const formattedFirstName = formatPersonName(personalInfo.firstName)
    const formattedLastName = formatPersonName(personalInfo.lastName)
    const formattedMiddleInitial = formatMiddleInitial(personalInfo.middleInitial)
    const formattedPhone = formatPhoneNumber(personalInfo.phone)

    const clientData: Record<string, unknown> = {
      firstName: formattedFirstName,
      lastName: formattedLastName,
      ...(formattedMiddleInitial ? { middleInitial: formattedMiddleInitial } : {}),
      email: accountInfo.email.trim().toLowerCase(),
      password: accountInfo.password,
      gender: personalInfo.gender,
      dob: formatDateOnlyISO(personalInfo.dob),
      phone: formattedPhone,
      referralType: screeningType.requestedBy,
      preferredContactMethod: 'email',
      disableClientEmails: false,
    }

    if (Array.isArray(medications) && medications.length > 0) {
      const today = getTodayDateOnlyISO()
      const createdAt = getCurrentIsoTimestamp()

      clientData.medications = medications.map((medication) => ({
        medicationName: medication.medicationName,
        detectedAs: medication.detectedAs,
        startDate: today,
        status: 'active',
        requireConfirmation: false,
        createdAt,
      }))
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
          source: 'frontend',
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
          source: 'frontend',
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
        clientData.referral = {
          relationTo: 'courts',
          value: recipients.selectedCourt,
        }
      }
    }

    await payload.create({
      collection: 'clients',
      data: clientData as any,
    })

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Registration failed',
    }
  }
}
