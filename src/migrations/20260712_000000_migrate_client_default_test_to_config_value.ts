import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-mongodb'

import { TEST_TYPES } from '@/config/test-types'

const TEST_TYPE_VALUES = new Set<string>(TEST_TYPES.map((testType) => testType.value))

type LegacyTestTypeRow = {
  _id: unknown
  value?: unknown
}

type ClientDefaultTestRow = {
  _id: unknown
  defaultTestType?: unknown
}

function normalizeStoredValue(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null
  if (value && typeof value === 'object' && 'toString' in value && typeof value.toString === 'function') {
    const normalized = value.toString().trim()
    return normalized && normalized !== '[object Object]' ? normalized : null
  }
  return null
}

export function resolveConfiguredDefaultTestValue(
  value: unknown,
  legacyIdToValue: ReadonlyMap<string, string>,
): string | null {
  const normalized = normalizeStoredValue(value)
  if (!normalized) return null
  if (TEST_TYPE_VALUES.has(normalized)) return normalized
  return legacyIdToValue.get(normalized) || null
}

async function loadLegacyTestTypeMaps(payload: MigrateUpArgs['payload']) {
  // `test-types` is deliberately no longer registered in Payload. Opening the
  // physical Mongo collection through the connection keeps this migration
  // runnable in a fresh production process without restoring the legacy model.
  const testTypesCollection = payload.db.connection.collection('test-types')
  const rows = (await testTypesCollection
    .find({ value: { $in: Array.from(TEST_TYPE_VALUES) } }, { projection: { _id: 1, value: 1 } })
    .toArray()) as LegacyTestTypeRow[]

  const idToValue = new Map<string, string>()
  const valueToId = new Map<string, unknown>()

  for (const row of rows) {
    const id = normalizeStoredValue(row._id)
    const value = typeof row.value === 'string' && TEST_TYPE_VALUES.has(row.value) ? row.value : null
    if (!id || !value) continue
    idToValue.set(id, value)
    valueToId.set(value, row._id)
  }

  return { idToValue, valueToId }
}

export async function up({ payload }: MigrateUpArgs): Promise<void> {
  const { idToValue } = await loadLegacyTestTypeMaps(payload)
  const clientsCollection = payload.db.collections.clients.collection
  const clients = (await clientsCollection
    .find({ defaultTestType: { $exists: true, $ne: null } }, { projection: { _id: 1, defaultTestType: 1 } })
    .toArray()) as ClientDefaultTestRow[]

  const updates: Array<{ id: unknown; value: string }> = []
  const unresolved: string[] = []

  for (const client of clients) {
    const currentValue = normalizeStoredValue(client.defaultTestType)
    const configuredValue = resolveConfiguredDefaultTestValue(client.defaultTestType, idToValue)
    if (!configuredValue) {
      unresolved.push(`${normalizeStoredValue(client._id) || 'unknown-client'}:${currentValue || 'unreadable-value'}`)
      continue
    }
    if (configuredValue === currentValue) continue

    updates.push({ id: client._id, value: configuredValue })
  }

  if (unresolved.length > 0) {
    throw new Error(
      `Could not resolve ${unresolved.length} client default test value(s) from the legacy test type collection: ${unresolved.slice(0, 10).join(', ')}`,
    )
  }

  for (const update of updates) {
    await clientsCollection.updateOne({ _id: update.id as never }, { $set: { defaultTestType: update.value } })
  }

  payload.logger.info(`Migrated ${updates.length} client default test relationship value(s) to config values`)
}

export async function down({ payload }: MigrateDownArgs): Promise<void> {
  const { valueToId } = await loadLegacyTestTypeMaps(payload)
  const clientsCollection = payload.db.collections.clients.collection
  let restored = 0

  for (const [value, legacyId] of valueToId) {
    const result = await clientsCollection.updateMany(
      { defaultTestType: value },
      { $set: { defaultTestType: legacyId } },
    )
    restored += result.modifiedCount
  }

  payload.logger.info(`Restored ${restored} client default test config value(s) to legacy relationship IDs`)
}
