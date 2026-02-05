'use server'

import { getPayload } from 'payload'
import config from '@payload-config'
import { sendEmails } from '@/collections/DrugTests/services'
import { getActiveMedications } from '@/collections/DrugTests/helpers/getActiveMedications'
import { buildCollectedEmail } from '@/collections/DrugTests/email/render'
import { fetchClientHeadshot } from '@/collections/DrugTests/email/fetch-headshot'
import { createAdminAlert } from '@/lib/admin-alerts'
import type { Client } from '@/payload-types'

// Extract medication type from Client payload type
type MedicationInput = NonNullable<Client['medications']>[number] & {
  _isNew?: boolean
  _wasDiscontinued?: boolean
}

export async function createCollectionWithEmailReview(
  testData: {
    clientId: string
    testType: '11-panel-lab' | '17-panel-sos-lab' | 'etg-lab'
    collectionDate: string
    breathalyzerTaken: boolean
    breathalyzerResult: number | null
    newHeadshotBuffer?: number[]
    newHeadshotMimetype?: string
    newHeadshotName?: string
  },
  medications: MedicationInput[],
  emailConfig: {
    referralEmailEnabled: boolean
    referralRecipients: string[]
  },
): Promise<{
  success: boolean
  testId?: string
  error?: string
}> {
  const payload = await getPayload({ config })

  try {
    // Validate client exists before proceeding
    const existingClient = await payload.findByID({
      collection: 'clients',
      id: testData.clientId,
      depth: 0,
      overrideAccess: true,
    })

    if (!existingClient) {
      return {
        success: false,
        error: 'Client not found. They may have been deleted. Please go back and select a different client.',
      }
    }

    // 1. Upload headshot if provided
    if (testData.newHeadshotBuffer && testData.newHeadshotMimetype && testData.newHeadshotName) {
      try {
        const buffer = Buffer.from(testData.newHeadshotBuffer)
        const uploadedHeadshot = await payload.create({
          collection: 'private-media',
          data: {
            documentType: 'headshot',
            relatedClient: testData.clientId,
          },
          file: {
            data: buffer,
            mimetype: testData.newHeadshotMimetype,
            name: testData.newHeadshotName,
            size: buffer.length,
          },
          overrideAccess: true,
        })

        await payload.update({
          collection: 'clients',
          id: testData.clientId,
          data: { headshot: uploadedHeadshot.id },
          overrideAccess: true,
        })
        payload.logger.info(`[createCollectionWithEmailReview] Uploaded and linked headshot ${uploadedHeadshot.id} for client ${testData.clientId}`)
      } catch (error) {
        payload.logger.error('[createCollectionWithEmailReview] Failed to upload headshot:', error)
        // Non-critical: continue with collection creation
      }
    }

    // 2. Update client medications if there are changes
    if (medications.length > 0) {
      // Filter out UI-only flags and prepare for database
      const cleanedMedications = medications.map((med) => {
        const { _isNew, _wasDiscontinued, ...cleanMed } = med
        // Ensure createdAt is set for new medications
        if (!cleanMed.createdAt) {
          return {
            ...cleanMed,
            createdAt: new Date().toISOString(),
          }
        }
        return cleanMed
      })

      await payload.update({
        collection: 'clients',
        id: testData.clientId,
        data: {
          medications: cleanedMedications,
        },
        overrideAccess: true,
      })
    }

    // 3. Fetch updated active medications for drug test snapshot
    const activeMedications = await getActiveMedications(testData.clientId, payload)

    // 3. Create drug test
    const drugTest = await payload.create({
      collection: 'drug-tests',
      data: {
        relatedClient: testData.clientId,
        testType: testData.testType,
        collectionDate: testData.collectionDate,
        screeningStatus: 'collected',
        detectedSubstances: [],
        isDilute: false,
        breathalyzerTaken: testData.breathalyzerTaken,
        breathalyzerResult: testData.breathalyzerResult,
        medicationsArrayAtTestTime: activeMedications,
        processNotes: 'Specimen collected - awaiting lab results (email review)',
      },
      overrideAccess: true,
    })

    // 4. Fetch client for email generation
    const client = await payload.findByID({
      collection: 'clients',
      id: testData.clientId,
      depth: 0,
    })

    // 5. Fetch client headshot for email embedding
    const clientHeadshotDataUri = await fetchClientHeadshot(testData.clientId, payload)

    // 6. Build email content
    const clientName = `${client.firstName} ${client.lastName}`
    const clientDob = client.dob || null
    const emailData = await buildCollectedEmail({
      clientName,
      collectionDate: testData.collectionDate,
      testType: testData.testType,
      breathalyzerTaken: testData.breathalyzerTaken,
      breathalyzerResult: testData.breathalyzerResult,
      clientHeadshotDataUri,
      clientDob,
    })

    // 4. Send emails using service layer (no attachment for collected stage)
    const referralRecipients = emailConfig.referralEmailEnabled ? emailConfig.referralRecipients : []

    const emailResult = await sendEmails({
      payload,
      clientEmail: null, // Collected stage doesn't send to client
      clientEmailData: null,
      referralEmails: referralRecipients,
      referralEmailData: emailData,
      emailStage: 'collected',
      drugTestId: drugTest.id,
      clientId: testData.clientId,
      clientName,
    })

    const sentTo = emailResult.sentTo
    const failedTo = emailResult.failedRecipients

    // 5. Update notification history
    const notificationEntry = {
      stage: 'collected',
      sentAt: new Date().toISOString() || null,
      recipients: sentTo.join(', ') || null,
      status: failedTo.length > 0 ? 'failed' : 'sent',
      intendedRecipients: emailConfig.referralRecipients.map((e) => `Referral: ${e}`).join(', ') || null,
      errorMessage: failedTo.length > 0 ? `Failed to send to: ${failedTo.join(', ')}` : null,
    } as const

    await payload.update({
      collection: 'drug-tests',
      id: drugTest.id,
      data: {
        notificationsSent: [notificationEntry],
      },
      overrideAccess: true,
    })

    // Check for email failures and return appropriate status
    if (failedTo.length > 0 && sentTo.length === 0) {
      // All emails failed
      return {
        success: false,
        testId: drugTest.id,
        error: `Collection recorded but all emails failed to send: ${failedTo.join(', ')}. Please send manually or retry.`,
      }
    } else if (failedTo.length > 0) {
      // Some emails failed - return partial success
      return {
        success: false,
        testId: drugTest.id,
        error: `Collection recorded and ${sentTo.length} email(s) sent, but ${failedTo.length} failed: ${failedTo.join(', ')}. Please check and resend failed emails.`,
      }
    }

    return { success: true, testId: drugTest.id }
  } catch (error) {
    payload.logger.error('Error creating collection with email review:', error)

    await createAdminAlert(payload, {
      severity: 'high',
      alertType: 'other',
      title: `Lab collection submission failed`,
      message: `Failed to create lab collection record.\n\nClient ID: ${testData.clientId}\nTest Type: ${testData.testType}\nError: ${error instanceof Error ? error.message : String(error)}`,
      context: {
        clientId: testData.clientId,
        testType: testData.testType,
        collectionDate: testData.collectionDate,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
      },
    })

    return {
      success: false,
      error: `Failed to create collection: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}
