import config from '@payload-config'
import { getPayload, type Payload } from 'payload'

import { withTimeout } from '@/lib/health/withTimeout'

const READINESS_TIMEOUT_MS = 4_000
const MONGODB_MAX_TIME_MS = 3_000

type ReadinessStatus = 'ok' | 'unavailable'

let previousStatus: ReadinessStatus | undefined

function remainingTime(deadline: number) {
  const remainingMs = Math.floor(deadline - performance.now())

  if (remainingMs <= 0) {
    throw new Error('Readiness check timed out')
  }

  return remainingMs
}

function recordStatusTransition(status: ReadinessStatus, payload?: Payload, error?: unknown) {
  if (previousStatus === status) return

  const previous = previousStatus
  previousStatus = status

  try {
    if (status === 'unavailable') {
      const diagnosticError = error instanceof Error ? error : new Error(String(error))

      if (payload) {
        payload.logger.error({
          msg: '[health] Application readiness check failed',
          err: diagnosticError,
        })
      } else {
        console.error('[health] Application readiness check failed', diagnosticError)
      }

      return
    }

    if (previous === 'unavailable') {
      payload?.logger.info('[health] Application readiness check recovered')
    }
  } catch {
    // A logging failure must never change the health response.
  }
}

export async function createReadinessResponse() {
  const startedAt = performance.now()
  const deadline = startedAt + READINESS_TIMEOUT_MS
  let payload: Payload | undefined

  try {
    payload = await withTimeout(
      getPayload({ config }),
      remainingTime(deadline),
      'Payload initialization health check timed out',
    )

    const database = payload.db.connection.db

    if (!database) {
      throw new Error('MongoDB connection is not initialized')
    }

    const remainingMs = remainingTime(deadline)
    const pingController = new AbortController()

    await withTimeout(
      database.command(
        { ping: 1, maxTimeMS: Math.min(MONGODB_MAX_TIME_MS, remainingMs) },
        {
          signal: pingController.signal,
          timeoutMS: Math.min(MONGODB_MAX_TIME_MS, remainingMs),
        },
      ),
      remainingMs,
      'MongoDB health check timed out',
      { onTimeout: () => pingController.abort() },
    )

    recordStatusTransition('ok', payload)

    return Response.json(
      {
        status: 'ok',
        checks: { application: 'ok', payload: 'ok', database: 'ok' },
        responseTimeMs: Math.round(performance.now() - startedAt),
        timestamp: new Date().toISOString(),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    recordStatusTransition('unavailable', payload, error)

    return Response.json(
      {
        status: 'unavailable',
        checks: {
          application: 'ok',
          payload: payload ? 'ok' : 'unavailable',
          database: payload ? 'unavailable' : 'unknown',
        },
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
