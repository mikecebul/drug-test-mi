import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-mongodb'

type ClientDobRow = {
  _id: unknown
  dob?: unknown
}

export type ShiftedClientDob = {
  dob: Date
  searchDob: string
}

function formatUtcDateKey(date: Date): string {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Shift the stored UTC calendar date and anchor it at UTC noon for Payload's
 * day-only picker. UTC components are intentional: they preserve the database
 * calendar date without applying the server or browser timezone.
 */
export function shiftStoredDobByUtcDays(value: unknown, days: number): ShiftedClientDob | null {
  let year: number
  let monthIndex: number
  let day: number

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null
    year = value.getUTCFullYear()
    monthIndex = value.getUTCMonth()
    day = value.getUTCDate()
  } else if (typeof value === 'string') {
    const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/)
    if (!match) return null
    year = Number(match[1])
    monthIndex = Number(match[2]) - 1
    day = Number(match[3])
  } else {
    return null
  }

  const sourceDate = new Date(Date.UTC(year, monthIndex, day))
  if (
    sourceDate.getUTCFullYear() !== year ||
    sourceDate.getUTCMonth() !== monthIndex ||
    sourceDate.getUTCDate() !== day
  ) {
    return null
  }

  sourceDate.setUTCDate(sourceDate.getUTCDate() + days)
  sourceDate.setUTCHours(12, 0, 0, 0)

  return {
    dob: sourceDate,
    searchDob: formatUtcDateKey(sourceDate),
  }
}

async function shiftAllClientDobs({
  days,
  payload,
  session,
}: {
  days: number
  payload: MigrateUpArgs['payload']
  session: MigrateUpArgs['session']
}): Promise<number> {
  const clientsCollection = payload.db.collections.clients.collection
  const clients = (await clientsCollection
    .find({}, { projection: { _id: 1, dob: 1 }, session })
    .toArray()) as ClientDobRow[]

  const updates: Array<{ id: unknown; shiftedDob: ShiftedClientDob }> = []
  const invalidClientIds: string[] = []

  for (const client of clients) {
    const shiftedDob = shiftStoredDobByUtcDays(client.dob, days)
    if (!shiftedDob) {
      invalidClientIds.push(String(client._id))
      continue
    }
    updates.push({ id: client._id, shiftedDob })
  }

  if (invalidClientIds.length > 0) {
    throw new Error(
      `Cannot shift DOB for ${invalidClientIds.length} client(s) with a missing or invalid value: ${invalidClientIds
        .slice(0, 10)
        .join(', ')}`,
    )
  }

  for (const update of updates) {
    await clientsCollection.updateOne(
      { _id: update.id as never },
      {
        $set: {
          dob: update.shiftedDob.dob,
          searchDob: update.shiftedDob.searchDob,
        },
      },
      { session },
    )
  }

  return updates.length
}

export async function up({ payload, session }: MigrateUpArgs): Promise<void> {
  const updated = await shiftAllClientDobs({ days: 1, payload, session })
  payload.logger.info(`Increased DOB by one calendar day for ${updated} client(s)`)
}

export async function down({ payload, session }: MigrateDownArgs): Promise<void> {
  const updated = await shiftAllClientDobs({ days: -1, payload, session })
  payload.logger.info(`Decreased DOB by one calendar day for ${updated} client(s)`)
}
