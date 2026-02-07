'use server'

import { getPayload } from 'payload'
import config from '@payload-config'
import { headers } from 'next/headers'
import { createAdminAlert } from '@/lib/admin-alerts'

/**
 * Links an existing private-media document to a client's headshot field.
 * Called after Payload's DocumentDrawer successfully creates the upload.
 *
 * Requires admin authentication.
 */
export async function linkHeadshot(
  clientId: string,
  headshotId: string,
): Promise<{ success: boolean; url?: string; id?: string; error?: string; errorCode?: string }> {
  const payload = await getPayload({ config })

  try {
    // 1. Verify caller is authenticated admin
    const headersList = await headers()
    const { user } = await payload.auth({ headers: headersList })

    if (!user || user.collection !== 'admins') {
      const errorMsg = 'Unauthorized: Admin access required'
      payload.logger.error({
        msg: '[linkHeadshot] Unauthorized access attempt',
        clientId,
        headshotId,
        userCollection: user?.collection,
      })

      await createAdminAlert(payload, {
        severity: 'high',
        alertType: 'data-integrity',
        title: 'Unauthorized headshot link attempt',
        message: `Attempted to link headshot without admin authentication. Client: ${clientId}, Headshot: ${headshotId}`,
        context: {
          clientId,
          headshotId,
          userCollection: user?.collection,
          userId: user?.id,
        },
      })

      return {
        success: false,
        error: errorMsg,
        errorCode: 'UNAUTHORIZED'
      }
    }

    // 2. Validate inputs
    if (!clientId || !headshotId) {
      const errorMsg = 'Missing required parameters: clientId or headshotId'
      payload.logger.error({
        msg: '[linkHeadshot] Validation failed',
        clientId,
        headshotId,
      })
      return {
        success: false,
        error: errorMsg,
        errorCode: 'INVALID_INPUT'
      }
    }

    payload.logger.info({
      msg: '[linkHeadshot] Starting headshot link operation',
      clientId,
      headshotId,
      adminId: user.id,
    })

    // 3. Link headshot to client
    await payload.update({
      collection: 'clients',
      id: clientId,
      data: { headshot: headshotId },
      overrideAccess: true,
    })

    // 4. Fetch the created doc to get the processed URL (thumbnail may have just been generated)
    const headshot = await payload.findByID({
      collection: 'private-media',
      id: headshotId,
      depth: 0,
    })

    if (!headshot) {
      const errorMsg = `Headshot document ${headshotId} not found after linking`
      payload.logger.error({
        msg: '[linkHeadshot] Headshot not found',
        clientId,
        headshotId,
      })

      await createAdminAlert(payload, {
        severity: 'high',
        alertType: 'document-missing',
        title: 'Headshot document missing after link',
        message: `Headshot ${headshotId} was linked to client ${clientId} but could not be retrieved afterward.`,
        context: {
          clientId,
          headshotId,
          adminId: user.id,
        },
      })

      return {
        success: false,
        error: errorMsg,
        errorCode: 'HEADSHOT_NOT_FOUND'
      }
    }

    payload.logger.info({
      msg: '[linkHeadshot] Successfully linked headshot',
      clientId,
      headshotId,
      hasURL: !!headshot.url,
      hasThumbnail: !!headshot.thumbnailURL,
    })

    return {
      success: true,
      url: headshot.thumbnailURL || headshot.url || undefined,
      id: headshotId
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined

    payload.logger.error({
      msg: '[linkHeadshot] Failed to link headshot',
      clientId,
      headshotId,
      error: errorMessage,
      errorStack,
      errorType: error?.constructor?.name,
    })

    // Create admin alert for critical failures
    await createAdminAlert(payload, {
      severity: 'critical',
      alertType: 'data-integrity',
      title: `Failed to link headshot for client ${clientId}`,
      message: `Error linking headshot ${headshotId} to client ${clientId}: ${errorMessage}`,
      context: {
        clientId,
        headshotId,
        error: errorMessage,
        errorStack,
      },
    })

    return {
      success: false,
      error: `Failed to link headshot: ${errorMessage}`,
      errorCode: 'LINK_FAILED'
    }
  }
}
