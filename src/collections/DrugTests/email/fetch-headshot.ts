import type { Payload } from 'payload'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { promises as fsPromises } from 'fs'
import path from 'path'

/**
 * Fetches a client's headshot image and returns a publicly accessible URL
 * for embedding in email HTML. Uses presigned URLs for S3 storage or
 * local file paths for development.
 *
 * @param clientId - The client ID to fetch the headshot for
 * @param payload - Payload instance
 * @returns Publicly accessible URL or null if no headshot
 */
export async function fetchClientHeadshot(
  clientId: string,
  payload: Payload,
): Promise<string | null> {
  try {
    payload.logger.info(`[HEADSHOT] Fetching headshot for client ${clientId}`)

    // Fetch the client with their headshot relationship
    const client = await payload.findByID({
      collection: 'clients',
      id: clientId,
      depth: 1, // Populate the headshot relationship
      overrideAccess: true, // Need to bypass access control to fetch private media
    })

    payload.logger.info(`[HEADSHOT] Client fetched, headshot value type: ${typeof client?.headshot}`)

    if (!client || !client.headshot) {
      payload.logger.info(`[HEADSHOT] No headshot found for client ${clientId}`)
      return null
    }

    // Get the headshot media object
    const headshot = typeof client.headshot === 'string' ? null : client.headshot

    payload.logger.info(`[HEADSHOT] Headshot object: ${JSON.stringify({
      id: headshot?.id,
      filename: headshot?.filename,
      mimeType: headshot?.mimeType,
      hasSizes: !!headshot?.sizes,
      hasThumbnail: !!headshot?.sizes?.thumbnail
    })}`)

    if (!headshot || !headshot.url || !headshot.mimeType) {
      payload.logger.warn(
        `[HEADSHOT] Client ${clientId} has a headshot reference but media object is incomplete`,
      )
      return null
    }

    // Use the thumbnail version (300x300) instead of full-size for smaller email size
    const thumbnail = headshot.sizes?.thumbnail
    const filenameToFetch = thumbnail?.filename || headshot.filename
    const _mimeType = thumbnail?.mimeType || headshot.mimeType

    if (!filenameToFetch) {
      payload.logger.warn(`No filename available for client ${clientId} headshot`)
      return null
    }

    const isS3Enabled = Boolean(process.env.NEXT_PUBLIC_S3_HOSTNAME)

    if (isS3Enabled) {
      // Production: Generate presigned URL from S3
      payload.logger.info(
        `Generating presigned URL for client headshot thumbnail: ${filenameToFetch}`,
      )

      const s3Client = new S3Client({
        credentials: {
          accessKeyId: process.env.S3_ACCESS_KEY_ID!,
          secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
        },
        endpoint: process.env.S3_ENDPOINT,
        forcePathStyle: true,
        region: process.env.S3_REGION,
      })

      const command = new GetObjectCommand({
        Bucket: process.env.S3_BUCKET!,
        Key: `private/${filenameToFetch}`, // Private media uses 'private/' prefix in S3
      })

      // Generate presigned URL valid for 7 days (604800 seconds)
      // This gives plenty of time for email recipients to view the image
      const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 604800 })

      payload.logger.info(`[HEADSHOT] Successfully generated presigned URL for client ${clientId} headshot`)

      return presignedUrl
    } else {
      // Development: Use Next.js public URL
      // In development, we'll need to serve the image through a public endpoint
      // For now, return a placeholder or the direct file path
      const localPath = path.join(process.cwd(), 'private-media', filenameToFetch)
      payload.logger.info(`[HEADSHOT] Development mode - checking local file: ${localPath}`)

      // Verify file exists
      await fsPromises.access(localPath)

      // In development, we'll need to create a public endpoint to serve these
      // For now, return null to skip the image in development emails
      // TODO: Create /api/email-assets/[filename] endpoint for development
      payload.logger.warn(`[HEADSHOT] Development mode - email images not yet supported locally`)
      return null
    }
  } catch (error) {
    payload.logger.error(`[HEADSHOT] Failed to fetch headshot for client ${clientId}:`, error)
    return null
  }
}
