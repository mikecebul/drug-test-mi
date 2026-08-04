import config from '@payload-config'
import { getPayload } from 'payload'

import { withTimeout } from '@/lib/health/withTimeout'

const HEALTH_CHECK_TIMEOUT_MS = 5_000

export const dynamic = 'force-dynamic'

export async function GET() {
  const startedAt = performance.now()

  try {
    const payload = await withTimeout(
      getPayload({ config }),
      HEALTH_CHECK_TIMEOUT_MS,
      'Payload initialization health check timed out',
    )
    const database = payload.db.connection.db

    if (!database) {
      throw new Error('MongoDB connection is not initialized')
    }

    await withTimeout(
      database.admin().ping({ maxTimeMS: HEALTH_CHECK_TIMEOUT_MS - 1_000 }),
      HEALTH_CHECK_TIMEOUT_MS,
      'MongoDB health check timed out',
    )

    return Response.json(
      {
        status: 'ok',
        checks: { database: 'ok' },
        responseTimeMs: Math.round(performance.now() - startedAt),
        timestamp: new Date().toISOString(),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch {
    return Response.json(
      {
        status: 'unavailable',
        checks: { database: 'unavailable' },
        responseTimeMs: Math.round(performance.now() - startedAt),
        timestamp: new Date().toISOString(),
      },
      {
        status: 503,
        headers: { 'Cache-Control': 'no-store' },
      },
    )
  }
}
