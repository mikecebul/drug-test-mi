import { runDbOp } from './db-process'
import type { FixtureContext } from './seed'

export async function cleanupFixtures(ctx: FixtureContext | undefined): Promise<void> {
  if (!ctx) return
  runDbOp<{ ok: true }>('cleanup-fixtures', ctx)
}
