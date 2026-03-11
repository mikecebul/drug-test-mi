import type { Job, Payload } from 'payload'

export const JOB_RUNS_COLLECTION_SLUG = 'job-runs'

export const JOB_TASK_LABELS = {
  createCollectionExport: 'Collection Export',
  createCollectionImport: 'Collection Import',
  inline: 'Inline Task',
  'redwood-backfill-client-unique-id': 'Redwood ID Backfill',
  'redwood-import-client': 'Redwood Import',
  'redwood-queue-pending-client-updates-nightly': 'Nightly Client Sync Sweep',
  'redwood-sync-default-test': 'Default Test Sync',
  'redwood-sync-headshot': 'Headshot Pull',
  'redwood-sync-missing-headshots-nightly': 'Nightly Headshot Sweep',
  'redwood-update-client': 'Client Sync',
  'redwood-upload-headshot': 'Headshot Push',
} as const

export type JobRunStatus = 'cancelled' | 'failed' | 'manual-review' | 'queued' | 'running' | 'succeeded'
export type KnownJobTaskSlug = keyof typeof JOB_TASK_LABELS

type JobRunSnapshot = Record<string, unknown> | null

type JobInputMetadata = {
  changedFieldsCsv: null | string
  clientId: null | string
  requestedByAdminId: null | string
  source: null | string
}

type JobLike = {
  id: Job['id']
  input?: unknown
  queue?: null | string
  taskSlug?: null | string
  totalTried?: null | number
}

export type JobRunRecord = {
  attemptCount?: null | number
  cancelledByAdmin?: null | string | { id: string }
  changedFieldsCsv?: null | string
  client?: null | string | { id: string }
  completedAt?: null | string
  createdAt: string
  errorMessage?: null | string
  id: string
  jobId: string
  outputSnapshot?: JobRunSnapshot
  queue: string
  requestedByAdmin?: null | string | { id: string }
  resultStatus?: null | string
  screenshotPath?: null | string
  source?: null | string
  startedAt?: null | string
  status: JobRunStatus
  summary?: null | string
  taskLabel: string
  taskSlug: string
  updatedAt: string
}

type PersistJobRunArgs = {
  attemptCount?: null | number
  cancelledByAdmin?: null | string
  changedFieldsCsv?: null | string
  client?: null | string
  completedAt?: null | string
  errorMessage?: null | string
  inputSnapshot?: JobRunSnapshot
  outputSnapshot?: JobRunSnapshot
  queue?: string
  requestedByAdmin?: null | string
  resultStatus?: null | string
  screenshotPath?: null | string
  source?: null | string
  startedAt?: null | string
  status?: JobRunStatus
  summary?: null | string
  taskLabel?: string
  taskSlug?: string
}

type JobRunPayloadOps = {
  create: (args: {
    collection: string
    data: Record<string, unknown>
    overrideAccess: boolean
  }) => Promise<unknown>
  find: (args: {
    collection: string
    depth: number
    limit: number
    overrideAccess: boolean
    sort?: string
    where: Record<string, unknown>
  }) => Promise<{ docs: unknown[] }>
  update: (args: {
    collection: string
    data: Record<string, unknown>
    id: string
    overrideAccess: boolean
  }) => Promise<unknown>
}

function getJobRunPayloadOps(payload: Payload): JobRunPayloadOps {
  return payload as unknown as JobRunPayloadOps
}

export function getJobTaskLabel(taskSlug: string): string {
  return JOB_TASK_LABELS[taskSlug as KnownJobTaskSlug] || taskSlug || 'Unknown task'
}

export function isKnownJobTaskSlug(taskSlug: string): taskSlug is KnownJobTaskSlug {
  return taskSlug in JOB_TASK_LABELS
}

function readString(value: unknown): null | string {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  return trimmed || null
}

function toSnapshot(value: unknown): JobRunSnapshot {
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    return null
  }

  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>
}

function readJobInputMetadata(input: unknown): JobInputMetadata {
  const snapshot = toSnapshot(input)

  return {
    changedFieldsCsv: readString(snapshot?.changedFieldsCsv),
    clientId: readString(snapshot?.clientId),
    requestedByAdminId: readString(snapshot?.requestedByAdminId),
    source: readString(snapshot?.source),
  }
}

function readAttemptCount(job: Pick<JobLike, 'totalTried'>): null | number {
  if (typeof job.totalTried !== 'number' || Number.isNaN(job.totalTried)) {
    return null
  }

  return job.totalTried
}

function compactData<T extends Record<string, unknown>>(data: T): T {
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined)) as T
}

function buildQueuedSummary(taskSlug: string, metadata: JobInputMetadata): string {
  switch (taskSlug) {
    case 'redwood-import-client':
      return metadata.source ? `Queued from ${metadata.source.replaceAll('-', ' ')}.` : 'Queued for Redwood import.'
    case 'redwood-update-client':
      return metadata.changedFieldsCsv
        ? `Queued Redwood sync for ${metadata.changedFieldsCsv}.`
        : 'Queued Redwood client sync.'
    case 'redwood-queue-pending-client-updates-nightly':
      return 'Nightly pending client sync sweep started.'
    case 'redwood-sync-missing-headshots-nightly':
      return 'Nightly missing headshot sweep started.'
    default:
      return `Queued ${getJobTaskLabel(taskSlug)}.`
  }
}

function buildCompletedSummary(status: JobRunStatus, resultStatus: null | string): string {
  if (status === 'cancelled') {
    return 'Cancelled before completion.'
  }

  if (status === 'failed') {
    return 'Job failed.'
  }

  if (status === 'manual-review') {
    return 'Manual review required.'
  }

  if (resultStatus && resultStatus !== 'succeeded' && resultStatus !== 'synced') {
    return `Completed with result: ${resultStatus}.`
  }

  return 'Completed successfully.'
}

async function findJobRunByJobId(payload: Payload, jobId: string): Promise<JobRunRecord | null> {
  const result = await getJobRunPayloadOps(payload).find({
    collection: JOB_RUNS_COLLECTION_SLUG,
    where: {
      jobId: {
        equals: jobId,
      },
    },
    sort: '-updatedAt',
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  return (result.docs[0] as JobRunRecord | undefined) || null
}

async function persistJobRun(payload: Payload, jobId: string, data: PersistJobRunArgs): Promise<void> {
  const existing = await findJobRunByJobId(payload, jobId)
  const jobRunPayload = getJobRunPayloadOps(payload)

  if (existing) {
    await jobRunPayload.update({
      collection: JOB_RUNS_COLLECTION_SLUG,
      id: existing.id,
      data: compactData(data) as Record<string, unknown>,
      overrideAccess: true,
    })

    return
  }

  const taskSlug = data.taskSlug || 'unknown'

  await jobRunPayload.create({
    collection: JOB_RUNS_COLLECTION_SLUG,
    data: compactData({
      attemptCount: data.attemptCount ?? null,
      cancelledByAdmin: data.cancelledByAdmin ?? null,
      changedFieldsCsv: data.changedFieldsCsv ?? null,
      client: data.client ?? null,
      completedAt: data.completedAt ?? null,
      errorMessage: data.errorMessage ?? null,
      inputSnapshot: data.inputSnapshot ?? null,
      jobId,
      outputSnapshot: data.outputSnapshot ?? null,
      queue: data.queue || 'default',
      requestedByAdmin: data.requestedByAdmin ?? null,
      resultStatus: data.resultStatus ?? null,
      screenshotPath: data.screenshotPath ?? null,
      source: data.source ?? null,
      startedAt: data.startedAt ?? null,
      status: data.status || 'queued',
      summary: data.summary ?? null,
      taskLabel: data.taskLabel || getJobTaskLabel(taskSlug),
      taskSlug,
    }) as Record<string, unknown>,
    overrideAccess: true,
  })
}

async function safelyPersistJobRun(payload: Payload, jobId: string, data: PersistJobRunArgs): Promise<void> {
  try {
    await persistJobRun(payload, jobId, data)
  } catch (error) {
    payload.logger.error({
      msg: '[job-runs] Failed to persist job run history',
      jobId,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

export async function recordQueuedJobRun(
  payload: Payload,
  args: {
    input?: unknown
    jobId: string
    queue?: string
    summary?: null | string
    taskSlug: string
  },
): Promise<void> {
  if (!isKnownJobTaskSlug(args.taskSlug)) {
    return
  }

  const metadata = readJobInputMetadata(args.input)

  await safelyPersistJobRun(payload, args.jobId, {
    changedFieldsCsv: metadata.changedFieldsCsv,
    client: metadata.clientId,
    inputSnapshot: toSnapshot(args.input),
    queue: args.queue || 'default',
    requestedByAdmin: metadata.requestedByAdminId,
    source: metadata.source,
    status: 'queued',
    summary: args.summary || buildQueuedSummary(args.taskSlug, metadata),
    taskLabel: getJobTaskLabel(args.taskSlug),
    taskSlug: args.taskSlug,
  })
}

export async function recordRunningJobRun(
  payload: Payload,
  job: JobLike,
): Promise<void> {
  const taskSlug = readString(job.taskSlug)
  if (!taskSlug || !isKnownJobTaskSlug(taskSlug)) {
    return
  }

  const metadata = readJobInputMetadata(job.input)

  await safelyPersistJobRun(payload, String(job.id), {
    attemptCount: readAttemptCount(job),
    changedFieldsCsv: metadata.changedFieldsCsv,
    client: metadata.clientId,
    inputSnapshot: toSnapshot(job.input),
    queue: readString(job.queue) || 'default',
    requestedByAdmin: metadata.requestedByAdminId,
    source: metadata.source,
    startedAt: new Date().toISOString(),
    status: 'running',
    summary: `Running ${getJobTaskLabel(taskSlug)}.`,
    taskLabel: getJobTaskLabel(taskSlug),
    taskSlug,
  })
}

export async function recordCompletedJobRun(
  payload: Payload,
  args: {
    errorMessage?: null | string
    job: JobLike
    output?: unknown
    resultStatus?: null | string
    screenshotPath?: null | string
    status: JobRunStatus
    summary?: null | string
  },
): Promise<void> {
  const taskSlug = readString(args.job.taskSlug)
  if (!taskSlug || !isKnownJobTaskSlug(taskSlug)) {
    return
  }

  const metadata = readJobInputMetadata(args.job.input)

  await safelyPersistJobRun(payload, String(args.job.id), {
    attemptCount: readAttemptCount(args.job),
    changedFieldsCsv: metadata.changedFieldsCsv,
    client: metadata.clientId,
    completedAt: new Date().toISOString(),
    errorMessage: args.errorMessage ?? null,
    outputSnapshot: toSnapshot(args.output),
    queue: readString(args.job.queue) || 'default',
    requestedByAdmin: metadata.requestedByAdminId,
    resultStatus: args.resultStatus ?? null,
    screenshotPath: args.screenshotPath ?? null,
    source: metadata.source,
    status: args.status,
    summary: args.summary || buildCompletedSummary(args.status, args.resultStatus ?? null),
    taskLabel: getJobTaskLabel(taskSlug),
    taskSlug,
  })
}

export async function recordCancelledJobRun(
  payload: Payload,
  args: {
    cancelledByAdminId?: null | string
    job?: Partial<JobLike> | null
    jobId: string
  },
): Promise<void> {
  try {
    const existing = await findJobRunByJobId(payload, args.jobId)
    const taskSlug = readString(args.job?.taskSlug) || readString(existing?.taskSlug)

    if (!taskSlug || !isKnownJobTaskSlug(taskSlug)) {
      return
    }

    const metadata = readJobInputMetadata(args.job?.input)

    await safelyPersistJobRun(payload, args.jobId, {
      attemptCount: args.job ? readAttemptCount(args.job as Pick<JobLike, 'totalTried'>) : null,
      cancelledByAdmin: args.cancelledByAdminId ?? null,
      changedFieldsCsv: metadata.changedFieldsCsv || readString(existing?.changedFieldsCsv),
      client: metadata.clientId || readString(existing?.client),
      completedAt: new Date().toISOString(),
      queue: readString(args.job?.queue) || readString(existing?.queue) || 'default',
      requestedByAdmin: metadata.requestedByAdminId || readString(existing?.requestedByAdmin),
      resultStatus: 'cancelled',
      source: metadata.source || readString(existing?.source),
      status: 'cancelled',
      summary: 'Cancelled by super-admin.',
      taskLabel: getJobTaskLabel(taskSlug),
      taskSlug,
    })
  } catch (error) {
    payload.logger.error({
      msg: '[job-runs] Failed to record cancelled job history',
      jobId: args.jobId,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
