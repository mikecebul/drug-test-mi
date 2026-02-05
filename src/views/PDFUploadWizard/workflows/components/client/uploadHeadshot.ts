'use server'

import { getPayload } from 'payload'
import config from '@payload-config'

export async function uploadHeadshot(
  clientId: string,
  headshotBuffer: number[],
  headshotMimetype: string,
  headshotName: string,
): Promise<{ success: boolean; url?: string; error?: string }> {
  const payload = await getPayload({ config })

  try {
    const buffer = Buffer.from(headshotBuffer)
    const uploadedHeadshot = await payload.create({
      collection: 'private-media',
      data: {
        documentType: 'headshot',
        relatedClient: clientId,
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
      data: { headshot: uploadedHeadshot.id },
      overrideAccess: true,
    })

    // Return the thumbnail URL (preferred) or full URL
    const url = uploadedHeadshot.thumbnailURL || uploadedHeadshot.url

    payload.logger.info(`[uploadHeadshot] Uploaded headshot ${uploadedHeadshot.id} for client ${clientId}`)

    return { success: true, url: url ?? undefined }
  } catch (error) {
    payload.logger.error('[uploadHeadshot] Failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
