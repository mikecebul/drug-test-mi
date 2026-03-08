import type { Payload } from 'payload'

import { createAdminAlert } from '@/lib/admin-alerts'
import { REDWOOD_SKIP_HEADSHOT_PUSH_CONTEXT_KEY } from '@/lib/redwood/context'
import { fetchRedwoodHeadshotForClient } from './redwoodHeadshotScraper'

async function updateRedwoodHeadshotSyncState(
  payload: Payload,
  clientId: string,
  {
    status,
    error,
  }: {
    status: 'queued' | 'synced' | 'failed' | 'manual-review'
    error?: string | null
  },
) {
  await payload.update({
    collection: 'clients',
    id: clientId,
    data: {
      redwoodHeadshotSyncStatus: status,
      redwoodHeadshotSyncLastAttemptAt: new Date().toISOString(),
      redwoodHeadshotSyncLastError: error ?? null,
    },
    overrideAccess: true,
  })
}

export async function runRedwoodHeadshotSyncJob(
  payload: Payload,
  clientId: string,
): Promise<{
  success: boolean
  headshotId?: string
  headshotUrl?: string
  matchedDonor?: string
  error?: string
  errorCode?: string
}> {
  let resolvedClientId: string | null = null

  try {
    if (!clientId) {
      return {
        success: false,
        error: 'Client ID is required',
        errorCode: 'INVALID_INPUT',
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

    resolvedClientId = client.id

    if (!client.firstName?.trim() || !client.lastName?.trim()) {
      const error = 'Client must have first and last name before syncing headshot'
      await updateRedwoodHeadshotSyncState(payload, client.id, {
        status: 'failed',
        error,
      })

      return {
        success: false,
        error,
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
      redwoodUniqueId: typeof client.redwoodUniqueId === 'string' ? client.redwoodUniqueId : undefined,
      redwoodDonorId: typeof client.redwoodDonorId === 'string' ? client.redwoodDonorId : undefined,
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
        redwoodDonorId: scraped.donorId || (typeof client.redwoodDonorId === 'string' ? client.redwoodDonorId : null),
        redwoodCallInCode: scraped.callInCode || (typeof client.redwoodCallInCode === 'string' ? client.redwoodCallInCode : null),
        redwoodHeadshotSyncStatus: 'synced',
        redwoodHeadshotSyncLastAttemptAt: new Date().toISOString(),
        redwoodHeadshotSyncLastError: null,
      },
      context: {
        [REDWOOD_SKIP_HEADSHOT_PUSH_CONTEXT_KEY]: true,
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
      msg: '[redwood-headshot] Successfully synced headshot',
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

    if (resolvedClientId) {
      try {
        await updateRedwoodHeadshotSyncState(payload, resolvedClientId, {
          status: 'failed',
          error: message,
        })
      } catch (stateError) {
        payload.logger.error({
          msg: '[redwood-headshot] Failed to persist headshot sync failure state',
          clientId: resolvedClientId,
          error: stateError instanceof Error ? stateError.message : String(stateError),
        })
      }
    }

    payload.logger.error({
      msg: '[redwood-headshot] Failed to sync Redwood headshot',
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
