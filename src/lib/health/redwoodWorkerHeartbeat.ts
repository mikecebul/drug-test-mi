import { writeFile } from 'node:fs/promises'

export const REDWOOD_WORKER_HEARTBEAT_PATH =
  process.env.REDWOOD_WORKER_HEARTBEAT_PATH?.trim() || '/tmp/redwood-worker-heartbeat'

export async function recordRedwoodWorkerHeartbeat(now = new Date()) {
  await writeFile(REDWOOD_WORKER_HEARTBEAT_PATH, now.toISOString(), 'utf8')
}
