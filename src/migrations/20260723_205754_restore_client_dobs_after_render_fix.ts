import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-mongodb'

import { shiftAllClientDobs } from './20260723_203006_increase_client_dobs_one_day'

/**
 * Compensate the already-applied one-day DOB increase.
 *
 * The original DOB calendar value was correct in MongoDB; UTC midnight merely
 * rendered as the prior day in Payload's admin UI. New code anchors DOBs at UTC
 * noon, so this migration only reverses the unnecessary calendar-day increase.
 */
export async function up({ payload, session }: MigrateUpArgs): Promise<void> {
  const updated = await shiftAllClientDobs({ days: -1, payload, session })
  payload.logger.info(`Restored the pre-migration DOB calendar date for ${updated} client(s)`)
}

export async function down({ payload, session }: MigrateDownArgs): Promise<void> {
  const updated = await shiftAllClientDobs({ days: 1, payload, session })
  payload.logger.info(`Reapplied the reverted DOB calendar-day increase for ${updated} client(s)`)
}
