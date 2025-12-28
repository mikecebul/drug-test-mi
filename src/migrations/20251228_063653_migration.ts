import { DrugTest } from '@/payload-types'
import { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-mongodb'

/**
 * Migration: Convert medicationsAtTestTime (string) to medicationsArrayAtTestTime (array)
 *
 * Reads from old text field: "Adderall, Xanax, Suboxone"
 * Writes to new array field: [
 *   { medicationName: "Adderall", detectedAs: ["amphetamines"] },
 *   { medicationName: "Xanax", detectedAs: ["benzodiazepines"] },
 *   { medicationName: "Suboxone", detectedAs: ["buprenorphine", "opiates"] }
 * ]
 */
export async function up({ payload }: MigrateUpArgs): Promise<void> {
  payload.logger.info('Starting migration: medicationsAtTestTime (string) -> medicationsArrayAtTestTime (array)')

  // Get all drug tests
  const drugTests = await payload.find({
    collection: 'drug-tests',
    limit: 1000,
    depth: 0,
  })

  payload.logger.info(`Found ${drugTests.docs.length} drug tests to migrate`)

  let migrated = 0
  let skipped = 0
  let errors = 0

  for (const test of drugTests.docs) {
    try {
      const medications = test.medicationsAtTestTime as any
      const existingArray = (test as any).medicationsArrayAtTestTime

      // Skip if new field already populated
      if (existingArray && Array.isArray(existingArray) && existingArray.length > 0) {
        skipped++
        continue
      }

      // Skip if old field is empty
      if (!medications) {
        skipped++
        continue
      }

      // Parse string format
      if (typeof medications === 'string') {
        // Handle special cases
        if (
          medications === 'No active medications' ||
          medications === 'No medications on file' ||
          medications === 'Error fetching medications' ||
          medications.trim() === ''
        ) {
          // Convert to empty array
          await payload.update({
            collection: 'drug-tests',
            id: test.id,
            data: {
              medicationsArrayAtTestTime: [] as DrugTest['medicationsArrayAtTestTime'],
            },
          })
          migrated++
          continue
        }

        // Parse comma-separated medication names
        const medNames = medications
          .split(',')
          .map((name) => name.trim())
          .filter((name) => name.length > 0)

        // Try to fetch client to get detectedAs values
        let medicationsArray: Array<{ medicationName: string; detectedAs: string[] }> = []

        try {
          const clientId = typeof test.relatedClient === 'string' ? test.relatedClient : test.relatedClient?.id

          if (clientId) {
            const client = await payload.findByID({
              collection: 'clients',
              id: clientId,
              depth: 0,
            })

            // Build a map of medication names to detectedAs
            const medMap = new Map<string, string[]>()
            if (client?.medications && Array.isArray(client.medications)) {
              client.medications.forEach((med: any) => {
                const normalizedName = med.medicationName?.toLowerCase().trim()
                if (normalizedName) {
                  medMap.set(normalizedName, med.detectedAs || [])
                }
              })
            }

            // Match medication names to get detectedAs
            medicationsArray = medNames.map((medName) => {
              const normalizedName = medName.toLowerCase().trim()
              const detectedAs = medMap.get(normalizedName) || []
              return {
                medicationName: medName, // Keep original case
                detectedAs,
              }
            })
          } else {
            // No client - just use medication names without detectedAs
            medicationsArray = medNames.map((medName) => ({
              medicationName: medName,
              detectedAs: [],
            }))
          }
        } catch (clientError) {
          payload.logger.warn(`Could not fetch client for test ${test.id}, using medication names only`)
          // Fallback: just use medication names
          medicationsArray = medNames.map((medName) => ({
            medicationName: medName,
            detectedAs: [],
          }))
        }

        // Write to NEW array field
        await payload.update({
          collection: 'drug-tests',
          id: test.id,
          data: {
            medicationsArrayAtTestTime: medicationsArray as DrugTest['medicationsArrayAtTestTime'],
          },
        })

        migrated++
      } else {
        payload.logger.warn(`Unexpected type for medicationsAtTestTime in test ${test.id}`)
        skipped++
      }
    } catch (error) {
      payload.logger.error(`Error migrating test ${test.id}:`)
      console.error('Full error details:', error)
      errors++
    }
  }

  payload.logger.info(`Migration complete: ${migrated} migrated, ${skipped} skipped, ${errors} errors`)
}

export async function down({ payload }: MigrateDownArgs): Promise<void> {
  payload.logger.info('Starting rollback: Clear medicationsArrayAtTestTime (keep medicationsAtTestTime as-is)')

  // Get all drug tests
  const drugTests = await payload.find({
    collection: 'drug-tests',
    limit: 1000,
    depth: 0,
  })

  payload.logger.info(`Found ${drugTests.docs.length} drug tests to rollback`)

  let rolledBack = 0
  let skipped = 0

  for (const test of drugTests.docs) {
    try {
      const arrayField = (test as any).medicationsArrayAtTestTime

      // Skip if new field is already empty
      if (!arrayField || (Array.isArray(arrayField) && arrayField.length === 0)) {
        skipped++
        continue
      }

      // Clear the new array field (keep old string field intact)
      await payload.update({
        collection: 'drug-tests',
        id: test.id,
        data: {
          medicationsArrayAtTestTime: [],
        },
      })

      rolledBack++
    } catch (error) {
      payload.logger.error(`Error rolling back test ${test.id}:`, error)
    }
  }

  payload.logger.info(`Rollback complete: ${rolledBack} rolled back, ${skipped} skipped`)
}
