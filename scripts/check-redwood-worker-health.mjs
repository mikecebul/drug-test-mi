import { readFile } from 'node:fs/promises'

const heartbeatPath = process.env.REDWOOD_WORKER_HEARTBEAT_PATH?.trim() || '/tmp/redwood-worker-heartbeat'
const configuredMaxAge = Number.parseInt(process.env.REDWOOD_WORKER_HEALTH_MAX_AGE_MS || '', 10)
const maxAgeMs = Number.isFinite(configuredMaxAge) && configuredMaxAge > 0 ? configuredMaxAge : 120_000

try {
  const heartbeat = new Date((await readFile(heartbeatPath, 'utf8')).trim())
  const ageMs = Date.now() - heartbeat.getTime()

  if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > maxAgeMs) {
    throw new Error(`Redwood worker heartbeat is stale (${ageMs}ms old; maximum ${maxAgeMs}ms)`)
  }
} catch (error) {
  console.error(`[redwood-worker-health] ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
}
