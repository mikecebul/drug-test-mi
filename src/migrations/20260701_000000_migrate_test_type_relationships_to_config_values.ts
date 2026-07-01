import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-mongodb'

const TEST_TYPE_VALUES = new Set([
  '11-panel-lab',
  '11-panel-lab-no-etg',
  '8-panel-lab',
  '15-panel-instant',
  '17-panel-instant',
  '17-panel-sos-lab',
  'etg-lab',
])

const FIELD_MIGRATIONS = [
  { collection: 'courts', field: 'preferredTestType' },
  { collection: 'employers', field: 'preferredTestType' },
  { collection: 'bookings', field: 'scheduledTestType' },
] as const

type Payload = MigrateUpArgs['payload']
type MigrationTarget = (typeof FIELD_MIGRATIONS)[number]

async function loadTestTypeMaps(payload: Payload) {
  const result = await payload.find({
    collection: 'test-types',
    depth: 0,
    limit: 1000,
    overrideAccess: true,
  })

  const idToValue = new Map<string, string>()
  const valueToId = new Map<string, string>()

  for (const testType of result.docs as Array<{ id?: unknown; value?: unknown }>) {
    const id = typeof testType.id === 'string' ? testType.id : null
    const value = typeof testType.value === 'string' && TEST_TYPE_VALUES.has(testType.value) ? testType.value : null

    if (!id || !value) continue
    idToValue.set(id, value)
    valueToId.set(value, id)
  }

  return { idToValue, valueToId }
}

function getFieldValue(doc: Record<string, unknown>, field: string) {
  return doc[field]
}

function getLegacyRelationshipId(value: unknown): string | null {
  if (typeof value === 'string' && value) return value
  if (value && typeof value === 'object' && 'id' in value && typeof value.id === 'string') {
    return value.id
  }
  return null
}

function getCanonicalTestTypeValue(value: unknown, idToValue: Map<string, string>) {
  if (typeof value === 'string' && TEST_TYPE_VALUES.has(value)) return value

  if (value && typeof value === 'object' && 'value' in value && typeof value.value === 'string') {
    const objectValue = value.value
    if (TEST_TYPE_VALUES.has(objectValue)) return objectValue
  }

  const relationshipId = getLegacyRelationshipId(value)
  return relationshipId ? idToValue.get(relationshipId) || null : null
}

async function migrateTargetToValues(payload: Payload, target: MigrationTarget, idToValue: Map<string, string>) {
  let page = 1
  let updated = 0
  let totalPages = 1

  do {
    const result = await payload.find({
      collection: target.collection,
      depth: 0,
      limit: 100,
      page,
      overrideAccess: true,
    })

    totalPages = result.totalPages || 1

    for (const doc of result.docs as unknown as Array<Record<string, unknown> & { id: string }>) {
      const currentValue = getFieldValue(doc, target.field)
      const canonicalValue = getCanonicalTestTypeValue(currentValue, idToValue)
      if (!canonicalValue || currentValue === canonicalValue) continue

      await payload.update({
        collection: target.collection,
        id: doc.id,
        data: {
          [target.field]: canonicalValue,
        },
        overrideAccess: true,
      })
      updated++
    }

    page++
  } while (page <= totalPages)

  return updated
}

async function migrateTargetToLegacyIds(payload: Payload, target: MigrationTarget, valueToId: Map<string, string>) {
  let page = 1
  let updated = 0
  let totalPages = 1

  do {
    const result = await payload.find({
      collection: target.collection,
      depth: 0,
      limit: 100,
      page,
      overrideAccess: true,
    })

    totalPages = result.totalPages || 1

    for (const doc of result.docs as unknown as Array<Record<string, unknown> & { id: string }>) {
      const currentValue = getFieldValue(doc, target.field)
      if (typeof currentValue !== 'string' || !TEST_TYPE_VALUES.has(currentValue)) continue

      const legacyId = valueToId.get(currentValue)
      if (!legacyId || legacyId === currentValue) continue

      await payload.update({
        collection: target.collection,
        id: doc.id,
        data: {
          [target.field]: legacyId,
        },
        overrideAccess: true,
      })
      updated++
    }

    page++
  } while (page <= totalPages)

  return updated
}

export async function up({ payload }: MigrateUpArgs): Promise<void> {
  const { idToValue } = await loadTestTypeMaps(payload)
  let updated = 0

  for (const target of FIELD_MIGRATIONS) {
    updated += await migrateTargetToValues(payload, target, idToValue)
  }

  payload.logger.info(`Migrated ${updated} test type relationship value(s) to config values`)
}

export async function down({ payload }: MigrateDownArgs): Promise<void> {
  const { valueToId } = await loadTestTypeMaps(payload)
  let updated = 0

  for (const target of FIELD_MIGRATIONS) {
    updated += await migrateTargetToLegacyIds(payload, target, valueToId)
  }

  payload.logger.info(`Restored ${updated} test type config value(s) to legacy relationship IDs`)
}
