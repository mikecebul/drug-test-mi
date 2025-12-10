import type { Payload } from 'payload'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { promises as fsPromises } from 'fs'
import path from 'path'

/**
 * Fetches a client's headshot image and converts it to a Base64 data URI
 * for embedding directly in email HTML
 *
 * @param clientId - The client ID to fetch the headshot for
 * @param payload - Payload instance
 * @returns Base64 data URI string (e.g., "data:image/jpeg;base64,/9j/4AAQ...") or null if no headshot
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
    const mimeType = thumbnail?.mimeType || headshot.mimeType

    if (!filenameToFetch) {
      payload.logger.warn(`No filename available for client ${clientId} headshot`)
      return null
    }

    // Fetch the image file as a buffer
    let imageBuffer: Buffer

    const isS3Enabled = Boolean(process.env.NEXT_PUBLIC_S3_HOSTNAME)

    if (isS3Enabled) {
      // Production: Fetch from S3
      payload.logger.info(
        `Fetching client headshot thumbnail from S3: ${filenameToFetch}`,
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

      const response = await s3Client.send(command)

      if (!response.Body) {
        throw new Error('S3 response body is empty')
      }

      // Convert stream to buffer
      const chunks: Uint8Array[] = []
      for await (const chunk of response.Body as any) {
        chunks.push(chunk)
      }
      imageBuffer = Buffer.concat(chunks)
    } else {
      // Development: Read from local disk (private media directory)
      const localPath = path.join(process.cwd(), 'private-media', filenameToFetch)
      payload.logger.info(`Reading client headshot thumbnail from local disk: ${localPath}`)

      await fsPromises.access(localPath)
      imageBuffer = await fsPromises.readFile(localPath)
    }

    // Convert to Base64 data URI
    const base64Image = imageBuffer.toString('base64')
    const dataUri = `data:${mimeType};base64,${base64Image}`

    payload.logger.info(`[HEADSHOT] Successfully converted client ${clientId} headshot to Base64 data URI (length: ${dataUri.length} chars)`)

    return dataUri
  } catch (error) {
    payload.logger.error(`[HEADSHOT] Failed to fetch headshot for client ${clientId}:`, error)
    return null
  }
}
