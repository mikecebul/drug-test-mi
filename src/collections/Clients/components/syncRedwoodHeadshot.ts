'use server'

import configPromise from '@payload-config'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import { createAdminAlert } from '@/lib/admin-alerts'
import { fetchRedwoodHeadshotForClient } from '../services/redwoodHeadshotScraper'

export async function syncRedwoodHeadshot(
  clientId: string,
): Promise<{
  success: boolean
  headshotId?: string
  headshotUrl?: string
  matchedDonor?: string
  error?: string
  errorCode?: string
}> {
  const payload = await getPayload({ config: configPromise })

  try {
    if (!clientId) {
      return {
        success: false,
        error: 'Client ID is required',
        errorCode: 'INVALID_INPUT',
      }
    }

    const { user } = await payload.auth({ headers: await headers() })

    if (!user || user.collection !== 'admins') {
      return {
        success: false,
        error: 'Unauthorized: Admin access required',
        errorCode: 'UNAUTHORIZED',
      }
    }

    const client = await payload.findByID({
      collection: 'clients',
      id: clientId,
      depth: 0,
      overrideAccess: true,
    })

    if (!client) {
      return {
        success: false,
        error: 'Client not found',
        errorCode: 'CLIENT_NOT_FOUND',
      }
    }

    if (!client.firstName?.trim() || !client.lastName?.trim()) {
      return {
        success: false,
        error: 'Client must have first and last name before syncing headshot',
        errorCode: 'MISSING_NAME',
      }
    }

    const previousHeadshotId =
      typeof client.headshot === 'string'
        ? client.headshot
        : client.headshot && typeof client.headshot === 'object' && 'id' in client.headshot
          ? String(client.headshot.id)
          : null

    const scraped = await fetchRedwoodHeadshotForClient({
      firstName: client.firstName,
      lastName: client.lastName,
      middleInitial: client.middleInitial || undefined,
      dob: client.dob || undefined,
    })

    const uploadedHeadshot = await payload.create({
      collection: 'private-media',
      data: {
        alt: `${client.firstName} ${client.lastName} headshot`,
        documentType: 'headshot',
        relatedClient: client.id,
      },
      file: {
        data: scraped.imageBuffer,
        mimetype: scraped.mimeType,
        name: scraped.fileName,
        size: scraped.imageBuffer.length,
      },
      overrideAccess: true,
    })

    await payload.update({
      collection: 'clients',
      id: client.id,
      data: {
        headshot: uploadedHeadshot.id,
      },
      overrideAccess: true,
    })

    if (previousHeadshotId && previousHeadshotId !== uploadedHeadshot.id) {
      await payload.delete({
        collection: 'private-media',
        id: previousHeadshotId,
        overrideAccess: true,
      })
    }

    const headshot = await payload.findByID({
      collection: 'private-media',
      id: uploadedHeadshot.id,
      depth: 0,
      overrideAccess: true,
    })

    payload.logger.info({
      msg: '[syncRedwoodHeadshot] Successfully synced headshot',
      clientId: client.id,
      matchedDonor: scraped.matchedDonorName,
      uploadedHeadshotId: uploadedHeadshot.id,
    })

    return {
      success: true,
      headshotId: uploadedHeadshot.id,
      headshotUrl: headshot.thumbnailURL || headshot.url || undefined,
      matchedDonor: scraped.matchedDonorName,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    const stack = error instanceof Error ? error.stack : undefined

    payload.logger.error({
      msg: '[syncRedwoodHeadshot] Failed to sync Redwood headshot',
      clientId,
      error: message,
      stack,
    })

    await createAdminAlert(payload, {
      severity: 'high',
      alertType: 'data-integrity',
      title: `Redwood headshot sync failed for client ${clientId}`,
      message,
      context: {
        clientId,
        error: message,
      },
    })

    return {
      success: false,
      error: message,
      errorCode: 'SYNC_FAILED',
    }
  }
}
