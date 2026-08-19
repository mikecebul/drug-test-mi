'use server'

import { getPayload } from 'payload'
import config from '@payload-config'
import { headers } from 'next/headers'
import { createAdminAlert } from '@/lib/admin-alerts'
import { REDWOOD_SKIP_HEADSHOT_PUSH_CONTEXT_KEY } from '@/lib/redwood/context'
import { queueRedwoodHeadshotUpload } from '@/lib/redwood/queue'

interface UploadHeadshotResult {
  success: boolean
  url?: string
  id?: string
  error?: string
  errorCode?: string
}

const MAX_HEADSHOT_UPLOAD_BYTES = 10 * 1024 * 1024

function buildClientHeadshotAlt(client: {
  firstName?: string | null
  middleInitial?: string | null
  lastName?: string | null
  fullName?: string | null
}): string {
  const firstName = client.firstName?.trim() ?? ''
  const lastName = client.lastName?.trim() ?? ''
  const middleInitialRaw = client.middleInitial?.trim() ?? ''
  const middleInitial = middleInitialRaw ? `${middleInitialRaw.replace(/\.$/, '')}.` : ''

  const assembledName = [firstName, middleInitial, lastName].filter(Boolean).join(' ').trim()
  if (assembledName) {
    return assembledName
  }

  const fullName = client.fullName?.trim()
  if (fullName) {
    return fullName
  }

  return 'Client headshot'
}

function extractRelationshipId(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value
  if (value && typeof value === 'object' && 'id' in value) return String(value.id)
  return null
}

function normalizeEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

export async function uploadHeadshot(
  clientId: string,
  headshotBuffer: number[],
  headshotMimetype: string,
  headshotName: string,
  expectedClientEmail: string,
): Promise<UploadHeadshotResult> {
  const payload = await getPayload({ config })
  let existingHeadshotId: string | null = null

  try {
    const headersList = await headers()
    const { user } = await payload.auth({ headers: headersList })

    if (!user || user.collection !== 'admins') {
      const errorMsg = 'Unauthorized: Admin access required'
      payload.logger.error({
        msg: '[uploadHeadshot] Unauthorized upload attempt',
        clientId,
        expectedClientEmail,
        userCollection: user?.collection,
      })

      await createAdminAlert(payload, {
        severity: 'high',
        alertType: 'data-integrity',
        title: 'Unauthorized headshot upload attempt',
        message: `Attempted headshot upload without admin authentication. Client: ${clientId}`,
        context: {
          clientId,
          expectedClientEmail,
          userCollection: user?.collection,
          userId: user?.id,
        },
      })

      return {
        success: false,
        error: errorMsg,
        errorCode: 'UNAUTHORIZED',
      }
    }

    if (
      !clientId ||
      !normalizeEmail(expectedClientEmail) ||
      !headshotName ||
      !headshotMimetype ||
      !Array.isArray(headshotBuffer) ||
      headshotBuffer.length === 0
    ) {
      return {
        success: false,
        error: 'Missing required upload parameters',
        errorCode: 'INVALID_INPUT',
      }
    }

    if (headshotBuffer.length > MAX_HEADSHOT_UPLOAD_BYTES) {
      return {
        success: false,
        error: 'Image too large after processing; retry with a smaller crop/photo.',
        errorCode: 'PAYLOAD_TOO_LARGE',
      }
    }

    if (headshotBuffer.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) {
      return {
        success: false,
        error: 'Invalid upload payload: headshot buffer must contain byte values.',
        errorCode: 'INVALID_INPUT',
      }
    }

    if (!headshotMimetype.startsWith('image/')) {
      return {
        success: false,
        error: `Invalid mimetype "${headshotMimetype}". Headshots must be images.`,
        errorCode: 'INVALID_INPUT',
      }
    }

    const buffer = Buffer.from(headshotBuffer)
    const client = await payload.findByID({
      collection: 'clients',
      id: clientId,
      depth: 0,
      overrideAccess: true,
    })
    const actualClientEmail = normalizeEmail(client?.email)
    if (actualClientEmail !== normalizeEmail(expectedClientEmail)) {
      const errorMsg = 'The selected client changed before the headshot was saved. Reopen the client and try again.'

      payload.logger.error({
        msg: '[uploadHeadshot] Refused headshot upload because client identity did not match',
        clientId,
        expectedClientEmail,
        actualClientEmail,
        adminId: String(user.id),
      })
      await createAdminAlert(payload, {
        severity: 'high',
        alertType: 'data-integrity',
        title: `Prevented headshot assignment to the wrong client ${clientId}`,
        message: errorMsg,
        context: {
          clientId,
          expectedClientEmail,
          actualClientEmail,
          adminId: String(user.id),
        },
      })

      return {
        success: false,
        error: errorMsg,
        errorCode: 'CLIENT_MISMATCH',
      }
    }

    existingHeadshotId = extractRelationshipId(client?.headshot)
    const altText = buildClientHeadshotAlt(client ?? {})

    payload.logger.info({
      msg: '[uploadHeadshot] Starting headshot upload',
      clientId,
      existingHeadshotId,
      adminId: user.id,
      bytes: buffer.length,
      mimetype: headshotMimetype,
    })

    const mediaDoc = existingHeadshotId
      ? await payload.update({
          collection: 'private-media',
          id: existingHeadshotId,
          data: {
            documentType: 'headshot',
            relatedClient: clientId,
            alt: altText,
          },
          file: {
            data: buffer,
            mimetype: headshotMimetype,
            name: headshotName,
            size: buffer.length,
          },
          overrideAccess: true,
        })
      : await payload.create({
          collection: 'private-media',
          data: {
            documentType: 'headshot',
            relatedClient: clientId,
            alt: altText,
          },
          file: {
            data: buffer,
            mimetype: headshotMimetype,
            name: headshotName,
            size: buffer.length,
          },
          overrideAccess: true,
        })

    const updatedClient = await payload.update({
      collection: 'clients',
      id: clientId,
      data: {
        headshot: mediaDoc.id,
      },
      context: {
        [REDWOOD_SKIP_HEADSHOT_PUSH_CONTEXT_KEY]: true,
      },
      overrideAccess: true,
      user,
    })

    const headshotId = String(mediaDoc.id)
    const linkedHeadshotId = extractRelationshipId(updatedClient?.headshot)
    if (linkedHeadshotId !== headshotId) {
      throw new Error(
        `Payload did not persist headshot ${headshotId} on client ${clientId}; saved relationship was ${linkedHeadshotId || 'empty'}.`,
      )
    }

    try {
      await queueRedwoodHeadshotUpload(clientId, String(user.id), payload)
    } catch (queueError) {
      payload.logger.error({
        msg: '[uploadHeadshot] Headshot saved, but Redwood upload could not be queued',
        clientId,
        headshotId,
        adminId: String(user.id),
        err: queueError,
      })
    }

    let url = mediaDoc.thumbnailURL || mediaDoc.url || undefined
    if (!url) {
      try {
        const fetchedMediaDoc = await payload.findByID({
          collection: 'private-media',
          id: mediaDoc.id,
          depth: 0,
          overrideAccess: true,
        })
        url = fetchedMediaDoc?.thumbnailURL || fetchedMediaDoc?.url || undefined
      } catch (refetchError) {
        payload.logger.error({
          msg: '[uploadHeadshot] Failed to re-fetch media URL after upload',
          clientId,
          headshotId,
          refetchError: refetchError instanceof Error ? refetchError.message : String(refetchError),
        })
      }
    }

    payload.logger.info({
      msg: '[uploadHeadshot] Headshot upload complete',
      clientId,
      headshotId,
      operation: existingHeadshotId ? 'update' : 'create',
      hasThumbnail: !!mediaDoc.thumbnailURL,
      hasUrl: !!mediaDoc.url,
      hasResolvedUrl: !!url,
    })

    return {
      success: true,
      url,
      id: headshotId,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined

    payload.logger.error({
      msg: '[uploadHeadshot] Failed to upload headshot',
      clientId,
      existingHeadshotId,
      error: errorMessage,
      errorStack,
      errorType: error?.constructor?.name,
    })

    await createAdminAlert(payload, {
      severity: 'critical',
      alertType: 'data-integrity',
      title: `Failed to upload headshot for client ${clientId}`,
      message: `Headshot upload failed: ${errorMessage}`,
      context: {
        clientId,
        existingHeadshotId,
        error: errorMessage,
      },
    })

    return {
      success: false,
      error: `Failed to upload headshot: ${errorMessage}`,
      errorCode: 'UPLOAD_FAILED',
    }
  }
}
