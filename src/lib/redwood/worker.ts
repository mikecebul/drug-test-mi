import { getPayload, type BinScript, type Payload } from 'payload'

import { recordRedwoodWorkerHeartbeat } from '@/lib/health/redwoodWorkerHeartbeat'

const DEFAULT_BATCH_LIMIT = 3

type QueueRunResult = Awaited<ReturnType<Payload['jobs']['run']>>

function readInteger(name: string, fallback: number, options: { min: number; max: number }) {
  const rawValue = process.env[name]?.trim()
  if (!rawValue) return fallback

  const parsed = Number.parseInt(rawValue, 10)
  if (!Number.isFinite(parsed)) return fallback

  return Math.min(options.max, Math.max(options.min, parsed))
}

function noJobsRemain(result: QueueRunResult) {
  return 'noJobsRemaining' in result && result.noJobsRemaining === true
}

function retryNeedsBackoff(result: QueueRunResult) {
  return 'remainingJobsFromQueried' in result && result.remainingJobsFromQueried > 0
}

export async function runRedwoodQueueBatch(payload: Payload, limit: number) {
  // Run one bounded batch per poll. Previously this function kept calling
  // Payload until it reported an empty queue. A stale/ambiguous queue result
  // could therefore become a tight database-read loop and monopolize the host.
  // Follow-up jobs are picked up by the next protected cron tick (at most five
  // seconds later with the production command).
  const result = await payload.jobs.run({
    limit,
    overrideAccess: true,
    queue: 'redwood',
  })

  if (noJobsRemain(result)) {
    return { retryNeedsBackoff: false, runs: 0 }
  }

  // A failed job may be immediately eligible for a retry. Returning to the
  // poll interval prevents all retries from being exhausted in one burst.
  return { retryNeedsBackoff: retryNeedsBackoff(result), runs: 1 }
}

export async function runRedwoodWorkerCycle(payload: Payload, limit: number) {
  try {
    await payload.jobs.handleSchedules({
      queue: 'redwood',
    })
  } catch (error) {
    payload.logger.error({
      msg: '[redwood-worker] Schedule check failed; continuing with queued work',
      err: error,
      queue: 'redwood',
    })
  }
  return runRedwoodQueueBatch(payload, limit)
}

export const script: BinScript = async (config) => {
  const payload = await getPayload({ config })
  const batchLimit = readInteger('REDWOOD_WORKER_BATCH_LIMIT', DEFAULT_BATCH_LIMIT, {
    min: 1,
    max: 100,
  })

  try {
    await runRedwoodWorkerCycle(payload, batchLimit)
    // A completed queue query proves that this protected cron tick reached
    // Payload and MongoDB. The container probe detects a stuck tick when this
    // heartbeat stops advancing.
    await recordRedwoodWorkerHeartbeat()
  } catch (error) {
    payload.logger.error({
      msg: '[redwood-worker] Worker tick failed; retrying on the next Payload cron tick',
      err: error,
      queue: 'redwood',
    })
  }
}
