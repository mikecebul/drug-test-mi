'use server'

import { getPayload } from 'payload'
import config from '@payload-config'
import type { FormValues } from '../validators'
import {
  COURT_CONFIGS,
  EMPLOYER_CONFIGS,
  isValidCourtType,
  isValidEmployerType,
} from '@/app/(frontend)/register/configs/recipient-configs'

export async function registerClientAction(formData: FormValues): Promise<{
  success: boolean
  clientId?: string
  clientFirstName?: string
  clientLastName?: string
  error?: string
}> {
  const payload = await getPayload({ config })

  try {
    const { personalInfo, accountInfo, screeningType, recipients } = formData

    // Check if email already exists
    const existingClient = await payload.find({
      collection: 'clients',
      where: { email: { equals: accountInfo.email } },
      limit: 1,
      overrideAccess: true,
    })

    if (existingClient.docs.length > 0) {
      return {
        success: false,
        error: 'A client with this email already exists.',
      }
    }

    // Upload headshot if provided
    let headshotId: string | undefined
    if (personalInfo.headshot) {
      try {
        const buffer = Buffer.from(await personalInfo.headshot.arrayBuffer())
        const uploadedHeadshot = await payload.create({
          collection: 'private-media',
          data: {
            documentType: 'headshot',
          },
          file: {
            data: buffer,
            mimetype: personalInfo.headshot.type,
            name: personalInfo.headshot.name,
            size: buffer.length,
          },
          overrideAccess: true,
        })
        headshotId = uploadedHeadshot.id
        payload.logger.info(`[registerClientAction] Uploaded headshot ${headshotId}`)
      } catch (error) {
        payload.logger.error('[registerClientAction] Failed to upload headshot:', error)
        // Continue with registration even if headshot upload fails
      }
    }

    // Build client data
    const clientData: any = {
      firstName: personalInfo.firstName,
      lastName: personalInfo.lastName,
      ...(personalInfo.middleInitial && { middleInitial: personalInfo.middleInitial }),
      email: accountInfo.email,
      password: accountInfo.password, // Use password from form (could be auto-generated or custom)
      gender: personalInfo.gender,
      dob: personalInfo.dob,
      phone: personalInfo.phone,
      clientType: screeningType.requestedBy,
      preferredContactMethod: 'email',
      _verified: true, // Auto-verify admin-created clients
      ...(headshotId && { headshot: headshotId }),
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

    // Update headshot with relatedClient reference
    if (headshotId) {
      try {
        await payload.update({
          collection: 'private-media',
          id: headshotId,
          data: {
            relatedClient: newClient.id,
          },
          overrideAccess: true,
        })
        payload.logger.info(`[registerClientAction] Linked headshot to client ${newClient.id}`)
      } catch (error) {
        payload.logger.error('[registerClientAction] Failed to link headshot to client:', error)
        // Non-critical error, continue
      }
    }

    payload.logger.info(`[registerClientAction] Created client ${newClient.id} for ${accountInfo.email}`)

    return {
      success: true,
      clientId: newClient.id,
      clientFirstName: newClient.firstName,
      clientLastName: newClient.lastName,
    }
  } catch (error) {
    payload.logger.error('[registerClientAction] Error:', error)
    return {
      success: false,
      error: `Failed to register client: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}
