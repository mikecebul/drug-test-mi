'use server'

import { getPayload } from 'payload'
import config from '@payload-config'
import { headers } from 'next/headers'
import { createAdminAlert } from '@/lib/admin-alerts'

interface UploadHeadshotResult {
  success: boolean
  url?: string
  id?: string
  error?: string
  errorCode?: string
}

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

export async function uploadHeadshot(
  clientId: string,
  headshotBuffer: number[],
  headshotMimetype: string,
  headshotName: string,
  existingHeadshotId?: string | null,
): Promise<UploadHeadshotResult> {
  const payload = await getPayload({ config })

  try {
    const headersList = await headers()
    const { user } = await payload.auth({ headers: headersList })

    if (!user || user.collection !== 'admins') {
      const errorMsg = 'Unauthorized: Admin access required'
      payload.logger.error({
        msg: '[uploadHeadshot] Unauthorized upload attempt',
        clientId,
        existingHeadshotId,
        userCollection: user?.collection,
      })

      await createAdminAlert(payload, {
        severity: 'high',
        alertType: 'data-integrity',
        title: 'Unauthorized headshot upload attempt',
        message: `Attempted headshot upload without admin authentication. Client: ${clientId}`,
        context: {
          clientId,
          existingHeadshotId,
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

    if (!clientId || !headshotName || !headshotMimetype || !Array.isArray(headshotBuffer) || headshotBuffer.length === 0) {
      return {
        success: false,
        error: 'Missing required upload parameters',
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

    await payload.update({
      collection: 'clients',
      id: clientId,
      data: {
        headshot: mediaDoc.id,
      },
      overrideAccess: true,
    })

    const headshotId = String(mediaDoc.id)
    const url = mediaDoc.thumbnailURL || mediaDoc.url || undefined

    payload.logger.info({
      msg: '[uploadHeadshot] Headshot upload complete',
      clientId,
      headshotId,
      operation: existingHeadshotId ? 'update' : 'create',
      hasThumbnail: !!mediaDoc.thumbnailURL,
      hasUrl: !!mediaDoc.url,
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
