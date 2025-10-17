import {
  MigrateDownArgs,
  MigrateUpArgs,
} from '@payloadcms/db-mongodb'
import fs from 'fs'
import path from 'path'
import https from 'https'
import http from 'http'

async function downloadFile(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http
    const file = fs.createWriteStream(destPath)

    protocol.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode}`))
        return
      }

      response.pipe(file)
      file.on('finish', () => {
        file.close()
        resolve()
      })
    }).on('error', (err) => {
      fs.unlink(destPath, () => {}) // Delete the file if download failed
      reject(err)
    })
  })
}

export async function up({ payload }: MigrateUpArgs): Promise<void> {
  // Migrate client headshots from 'media' to 'private-media' collection
  payload.logger.info('Starting migration: Moving client headshots to private-media')

  // Find all clients with headshots
  const clients = await payload.find({
    collection: 'clients',
    limit: 1000,
    where: {
      headshot: {
        exists: true,
      },
    },
  })

  payload.logger.info(`Found ${clients.docs.length} clients with headshots`)

  let successCount = 0
  let errorCount = 0
  let skippedCount = 0

  for (const client of clients.docs) {
    try {
      const headshotId = typeof client.headshot === 'string' ? client.headshot : client.headshot?.id

      if (!headshotId) {
        payload.logger.warn(`Client ${client.id} has no valid headshot ID, skipping`)
        skippedCount++
        continue
      }

      // Fetch the original media document
      const originalMedia = await payload.findByID({
        collection: 'media',
        id: headshotId,
      })

      payload.logger.info(`Processing headshot for client ${client.id}: ${originalMedia.filename}`)

      // Check if already migrated
      const existingPrivateMedia = await payload.find({
        collection: 'private-media',
        where: {
          and: [
            {
              relatedClient: {
                equals: client.id,
              },
            },
            {
              documentType: {
                equals: 'headshot',
              },
            },
          ],
        },
      })

      if (existingPrivateMedia.docs.length > 0) {
        payload.logger.info(`Headshot already migrated for client ${client.id}, skipping`)

        // Update client to point to existing private-media entry
        await payload.update({
          collection: 'clients',
          id: client.id as string,
          data: {
            headshot: existingPrivateMedia.docs[0].id,
          },
        })

        skippedCount++
        continue
      }

      // Download the file from S3
      if (!originalMedia.url) {
        payload.logger.error(`No URL found for media ${headshotId}, cannot download`)
        errorCount++
        continue
      }

      const tempDir = path.join(process.cwd(), 'temp-migration')
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true })
      }

      const tempFilePath = path.join(tempDir, originalMedia.filename || `temp-${headshotId}`)

      payload.logger.info(`Downloading from ${originalMedia.url}`)
      await downloadFile(originalMedia.url, tempFilePath)

      // Create the file buffer
      const fileBuffer = fs.readFileSync(tempFilePath)

      // Create new private-media entry with the file
      const newPrivateMedia = await payload.create({
        collection: 'private-media',
        data: {
          alt: originalMedia.alt || `Headshot for ${client.firstName} ${client.lastName}`,
          documentType: 'headshot',
          relatedClient: client.id,
        },
        file: {
          data: fileBuffer,
          mimetype: originalMedia.mimeType || 'image/jpeg',
          name: originalMedia.filename || `headshot-${client.id}.jpg`,
          size: fileBuffer.length,
        },
      })

      payload.logger.info(`Created private-media entry ${newPrivateMedia.id} for client ${client.id}`)

      // Update client to reference new private-media entry
      await payload.update({
        collection: 'clients',
        id: client.id as string,
        data: {
          headshot: newPrivateMedia.id,
        },
      })

      payload.logger.info(`Updated client ${client.id} to reference new headshot`)

      // Clean up temp file
      fs.unlinkSync(tempFilePath)

      successCount++

    } catch (error) {
      payload.logger.error(`Error processing client ${client.id}: ${error}`)
      errorCount++
    }
  }

  // Clean up temp directory
  const tempDir = path.join(process.cwd(), 'temp-migration')
  if (fs.existsSync(tempDir)) {
    fs.rmdirSync(tempDir, { recursive: true })
  }

  payload.logger.info('\n=== Migration Summary ===')
  payload.logger.info(`Total clients: ${clients.docs.length}`)
  payload.logger.info(`Successfully migrated: ${successCount}`)
  payload.logger.info(`Skipped (already migrated): ${skippedCount}`)
  payload.logger.info(`Errors: ${errorCount}`)
  payload.logger.info('=========================\n')
}

export async function down({ payload }: MigrateDownArgs): Promise<void> {
  // Rollback: Restore client headshots to point back to 'media' collection
  payload.logger.info('Rolling back migration: This requires manual intervention')
  payload.logger.warn('To rollback, update client.headshot fields to reference original media collection entries')
  // Note: Actual rollback requires manual intervention since files may have been moved
}
