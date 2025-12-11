import type { Payload } from 'payload'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { promises as fsPromises } from 'fs'
import path from 'path'

export type FetchDocumentResult = {
  buffer: Buffer
  filename: string
  mimeType: string
}

/**
 * Fetches a document from the private-media collection and retrieves the file buffer
 * Handles both S3 (production) and local disk (development) storage transparently
 *
 * @param documentId - The ID of the document in the private-media collection
 * @param payload - Payload instance
 * @returns Document buffer and metadata
 * @throws Error if document not found, has no filename, or file cannot be retrieved
 */
export async function fetchDocument(
  documentId: string,
  payload: Payload,
): Promise<FetchDocumentResult> {
  // Fetch the document record from database using local API with overrideAccess
  const document = await payload.findByID({
    collection: 'private-media',
    id: documentId,
    overrideAccess: true,
  })

  if (!document || !document.filename) {
    throw new Error(
      `Document ${documentId} not found in database or has no filename. This indicates a data integrity issue.`,
    )
  }

  const mimeType = document.mimeType || 'application/pdf'
  const filename = document.filename

  // Fetch file buffer - handle both S3 (production) and local storage (development)
  const isS3Enabled = Boolean(process.env.NEXT_PUBLIC_S3_HOSTNAME)

  let fileBuffer: Buffer

  if (isS3Enabled) {
    // Production: Fetch from S3 using AWS SDK
    payload.logger.info(`Fetching document from S3: ${filename}`)

    // Initialize S3 client with credentials
    const s3Client = new S3Client({
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID!,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
      },
      endpoint: process.env.S3_ENDPOINT,
      forcePathStyle: true,
      region: process.env.S3_REGION,
    })

    // Fetch file from S3
    const command = new GetObjectCommand({
      Bucket: process.env.S3_BUCKET!,
      Key: `private/${filename}`,
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
    fileBuffer = Buffer.concat(chunks)

    payload.logger.info(`Successfully fetched document from S3: ${filename}`)
  } else {
    // Development: Read directly from local disk
    const localPath = path.join(process.cwd(), 'private-media', filename)
    payload.logger.info(`Reading document from local disk: ${localPath}`)

    await fsPromises.access(localPath)
    fileBuffer = await fsPromises.readFile(localPath)

    payload.logger.info(`Successfully read document from disk: ${filename}`)
  }

  return {
    buffer: fileBuffer,
    filename,
    mimeType,
  }
}
