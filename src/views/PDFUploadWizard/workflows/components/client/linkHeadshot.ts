'use server'

import { getPayload } from 'payload'
import config from '@payload-config'

/**
 * Links an existing private-media document to a client's headshot field.
 * Called after Payload's DocumentDrawer successfully creates the upload.
 */
export async function linkHeadshot(
  clientId: string,
  headshotId: string,
): Promise<{ success: boolean; url?: string; id?: string }> {
  const payload = await getPayload({ config })

  try {
    await payload.update({
      collection: 'clients',
      id: clientId,
      data: { headshot: headshotId },
      overrideAccess: true,
    })

    // Fetch the created doc to get the processed URL (thumbnail may have just been generated)
    const headshot = await payload.findByID({
      collection: 'private-media',
      id: headshotId,
      depth: 0,
    })

    payload.logger.info(`[linkHeadshot] Linked headshot ${headshotId} to client ${clientId}`)

    return { success: true, url: headshot.thumbnailURL || headshot.url || undefined, id: headshotId }
  } catch (error) {
    payload.logger.error('[linkHeadshot] Failed:', error)
    return { success: false }
  }
}
