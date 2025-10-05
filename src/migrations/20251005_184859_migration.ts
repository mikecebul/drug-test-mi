import {
  MigrateDownArgs,
  MigrateUpArgs,
} from '@payloadcms/db-mongodb'

// Mapping of old text values to new structured values for medication substances
const SUBSTANCE_MAPPING: Record<string, string> = {
  // Lowercase variations
  'amphetamine': 'amphetamines',
  'amphetamines': 'amphetamines',
  'methamphetamine': 'methamphetamines',
  'methamphetamines': 'methamphetamines',
  'benzodiazepine': 'benzodiazepines',
  'benzodiazepines': 'benzodiazepines',
  'thc': 'thc',
  'marijuana': 'thc',
  'cannabis': 'thc',
  'opiates': 'opiates',
  'opiate': 'opiates',
  'oxycodone': 'oxycodone',
  'oxy': 'oxycodone',
  'cocaine': 'cocaine',
  'coke': 'cocaine',
  'pcp': 'pcp',
  'barbiturates': 'barbiturates',
  'barbiturate': 'barbiturates',
  'methadone': 'methadone',
  'mdma': 'mdma',
  'ecstasy': 'mdma',
  'buprenorphine': 'buprenorphine',
  'suboxone': 'buprenorphine',
  'tramadol': 'tramadol',
  'fentanyl': 'fentanyl',
  'kratom': 'kratom',
  'etg': 'etg',
  'alcohol': 'etg',
  '6-mam': '6-mam',
  'heroin': '6-mam',
  'synthetic cannabinoid': 'synthetic_cannabinoids',
  'synthetic cannabinoids': 'synthetic_cannabinoids',
  'k2': 'synthetic_cannabinoids',
  'spice': 'synthetic_cannabinoids',
}

export async function up({ payload }: MigrateUpArgs): Promise<void> {
  console.log('\n' + '='.repeat(70))
  console.log('🔄 RUNNING MIGRATION: Drug Tests Schema Update')
  console.log('='.repeat(70) + '\n')

  // =========================================================================
  // PHASE 1: Migrate DrugTests Collection
  // =========================================================================
  console.log('PHASE 1: Migrating DrugTests Collection')
  console.log('-'.repeat(70))

  const { docs: drugTests } = await payload.find({
    collection: 'drug-tests',
    limit: 1000,
    depth: 0,
  })

  console.log(`Found ${drugTests.length} drug tests to migrate\n`)

  let migratedTests = 0
  let skippedTests = 0

  for (const test of drugTests) {
    const updates: any = {}
    let needsUpdate = false

    // 1. Migrate presumptivePositive → detectedSubstances
    if ((test as any).presumptivePositive) {
      const oldValue = (test as any).presumptivePositive
      updates.detectedSubstances = [oldValue]
      console.log(`  [${test.id}] presumptivePositive "${oldValue}" → detectedSubstances`)
      needsUpdate = true
    } else if (test.initialScreenResult === 'negative' || !test.initialScreenResult) {
      updates.detectedSubstances = []
      needsUpdate = true
    }

    // 2. Migrate confirmationStatus → confirmationResults
    if ((test as any).confirmationStatus && (test as any).confirmationStatus !== 'pending-confirmation') {
      const oldStatus = (test as any).confirmationStatus

      if (test.confirmationSubstances && Array.isArray(test.confirmationSubstances)) {
        updates.confirmationResults = test.confirmationSubstances.map((substance: string) => ({
          substance: substance,
          result: oldStatus,
          notes: 'Migrated from old confirmationStatus field',
        }))
        console.log(`  [${test.id}] confirmationStatus → confirmationResults (${updates.confirmationResults.length} substances)`)
        needsUpdate = true
      } else if ((test as any).presumptivePositive) {
        updates.confirmationResults = [{
          substance: (test as any).presumptivePositive,
          result: oldStatus,
          notes: 'Migrated from old confirmationStatus field',
        }]
        console.log(`  [${test.id}] confirmationStatus → confirmationResults (1 substance)`)
        needsUpdate = true
      }
    }

    // 3. Set confirmationSubstances if missing but confirmation was requested
    if (test.confirmationDecision === 'request-confirmation' && !test.confirmationSubstances) {
      if ((test as any).presumptivePositive) {
        updates.confirmationSubstances = [(test as any).presumptivePositive]
        console.log(`  [${test.id}] Added confirmationSubstances from presumptivePositive`)
        needsUpdate = true
      }
    }

    if (needsUpdate) {
      await payload.update({
        collection: 'drug-tests',
        id: test.id,
        data: updates,
        overrideAccess: true,
      })
      migratedTests++
    } else {
      skippedTests++
    }
  }

  console.log(`\nPhase 1: ${migratedTests} migrated, ${skippedTests} skipped`)

  // =========================================================================
  // PHASE 2: Re-compute Test Results
  // =========================================================================
  console.log('\nPHASE 2: Re-computing Test Results with Business Logic')
  console.log('-'.repeat(70))

  const { docs: allTests } = await payload.find({
    collection: 'drug-tests',
    limit: 1000,
    depth: 1,
  })

  let recomputed = 0

  for (const test of allTests) {
    if (test.detectedSubstances !== undefined) {
      // Re-save to trigger computeTestResults hook
      await payload.update({
        collection: 'drug-tests',
        id: test.id,
        data: {
          detectedSubstances: test.detectedSubstances || [],
        },
        overrideAccess: true,
      })
      recomputed++
    }
  }

  console.log(`\nPhase 2: ${recomputed} tests re-computed`)

  // =========================================================================
  // PHASE 3: Migrate Clients Medication detectedAs
  // =========================================================================
  console.log('\nPHASE 3: Migrating Clients Medication detectedAs')
  console.log('-'.repeat(70))

  const { docs: clients } = await payload.find({
    collection: 'clients',
    limit: 1000,
    depth: 0,
  })

  let updatedClients = 0
  let skippedClients = 0
  const unknownSubstances: string[] = []

  for (const client of clients) {
    if (!client.medications || client.medications.length === 0) {
      skippedClients++
      continue
    }

    let needsUpdate = false
    const updatedMedications = client.medications.map((med: any) => {
      // If detectedAs is a string, convert to array
      if (typeof med.detectedAs === 'string' && med.detectedAs.trim()) {
        needsUpdate = true
        const oldValue = med.detectedAs.toLowerCase().trim()
        const mappedValue = SUBSTANCE_MAPPING[oldValue]

        if (mappedValue) {
          console.log(`  [${client.email}] "${med.medicationName}": "${med.detectedAs}" → ["${mappedValue}"]`)
          return {
            ...med,
            detectedAs: [mappedValue],
          }
        } else {
          console.warn(`  ⚠️  [${client.email}] Unknown substance: "${med.detectedAs}"`)
          unknownSubstances.push(med.detectedAs)
          return med
        }
      }

      return med
    })

    if (needsUpdate) {
      await payload.update({
        collection: 'clients',
        id: client.id,
        data: {
          medications: updatedMedications,
        },
        overrideAccess: true,
      })
      updatedClients++
    } else {
      skippedClients++
    }
  }

  console.log(`\nPhase 3: ${updatedClients} clients updated, ${skippedClients} skipped`)

  if (unknownSubstances.length > 0) {
    console.log('\n⚠️  Unknown substances found (may need manual review):')
    const unique = [...new Set(unknownSubstances)]
    unique.forEach(substance => console.log(`   - "${substance}"`))
  }

  // =========================================================================
  // SUMMARY
  // =========================================================================
  console.log('\n' + '='.repeat(70))
  console.log('✅ MIGRATION COMPLETE')
  console.log('='.repeat(70))
  console.log(`  Drug Tests migrated: ${migratedTests}`)
  console.log(`  Drug Tests re-computed: ${recomputed}`)
  console.log(`  Clients updated: ${updatedClients}`)
  console.log('='.repeat(70) + '\n')
}

export async function down({}: MigrateDownArgs): Promise<void> {
  console.log('\n' + '='.repeat(70))
  console.log('⚠️  ROLLBACK: Drug Tests Schema Migration')
  console.log('='.repeat(70))
  console.log('\n⚠️  WARNING: Rollback not fully implemented')
  console.log('This migration cannot be fully reversed automatically.')
  console.log('The new computed fields cannot be converted back to old schema.')
  console.log('Please restore from backup if rollback is needed.')
  console.log('\n' + '='.repeat(70) + '\n')
}
