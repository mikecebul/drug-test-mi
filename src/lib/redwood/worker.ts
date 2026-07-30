import { getPayload, type BinScript, type Payload } from 'payload'

const DEFAULT_BATCH_LIMIT = 3
const DEFAULT_POLL_MS = 1_000
const MIN_POLL_MS = 250
const MAX_POLL_MS = 60_000

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

export async function drainRedwoodQueue(payload: Payload, limit: number) {
  let runs = 0

  while (true) {
    const result = await payload.jobs.run({
      limit,
      overrideAccess: true,
      queue: 'redwood',
    })

    if (noJobsRemain(result)) {
      return { retryNeedsBackoff: false, runs }
    }

    runs += 1

    // A failed job may be immediately eligible for a retry. Give the external
    // service a short backoff instead of exhausting all retries in one burst.
    if (retryNeedsBackoff(result)) {
      return { retryNeedsBackoff: true, runs }
    }
  }
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
  return drainRedwoodQueue(payload, limit)
}

function waitForNextPoll(delayMs: number, signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    if (signal.aborted) {
      resolve()
      return
    }

    const timeoutId = setTimeout(finish, delayMs)

    function finish() {
      clearTimeout(timeoutId)
      signal.removeEventListener('abort', finish)
      resolve()
    }

    signal.addEventListener('abort', finish, { once: true })
  })
}

export const script: BinScript = async (config) => {
  const payload = await getPayload({ config })
  const batchLimit = readInteger('REDWOOD_WORKER_BATCH_LIMIT', DEFAULT_BATCH_LIMIT, {
    min: 1,
    max: 100,
  })
  const pollMs = readInteger('REDWOOD_WORKER_POLL_MS', DEFAULT_POLL_MS, {
    min: MIN_POLL_MS,
    max: MAX_POLL_MS,
  })
  const stopController = new AbortController()

  const stop = () => {
    stopController.abort()
  }

  process.once('SIGINT', stop)
  process.once('SIGTERM', stop)

  payload.logger.info({
    msg: '[redwood-worker] Started long-lived queue worker',
    batchLimit,
    idlePollMs: pollMs,
    queue: 'redwood',
  })

  try {
    while (!stopController.signal.aborted) {
      try {
        await runRedwoodWorkerCycle(payload, batchLimit)
      } catch (error) {
        payload.logger.error({
          msg: '[redwood-worker] Queue poll failed; retrying after the idle interval',
          err: error,
          idlePollMs: pollMs,
          queue: 'redwood',
        })
      }

      await waitForNextPoll(pollMs, stopController.signal)
    }
  } finally {
    process.removeListener('SIGINT', stop)
    process.removeListener('SIGTERM', stop)
    await payload.destroy()
  }
}
