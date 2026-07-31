import { isDeepStrictEqual } from 'node:util'

import type { Payload, PayloadRequest } from 'payload'

import { getRandomTestingSyncRuntimeState } from '@/lib/random-testing/runtime'
import { getRedwoodAutomationRuntimeState } from '@/lib/redwood/config'

import { JOB_RUNS_COLLECTION_SLUG, getJobTaskLabel, recordQueuedJobRun, type JobRunRecord } from './jobRuns'
import { isRetryableJobTaskSlug, type RetryableJobTaskSlug } from './retryableTasks'

type RetryJobQueue = (args: {
  input: Record<string, unknown>
  meta: Record<string, unknown>
  overrideAccess: true
  queue: string
  req?: PayloadRequest
  task: RetryableJobTaskSlug
}) => Promise<{ id: number | string }>

export type RetryFailedJobRunResult = {
  deduplicated: boolean
  jobId: string
  taskLabel: string
}

function reqOption(req?: PayloadRequest): { req: PayloadRequest } | Record<string, never> {
  return req ? { req } : {}
}

function readSnapshot(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }

  return structuredClone(value as Record<string, unknown>)
}

function buildRetryInput(
  taskSlug: RetryableJobTaskSlug,
  inputSnapshot: unknown,
  requestedByAdminId: string,
): Record<string, unknown> {
  const input = readSnapshot(inputSnapshot)

  if (taskSlug === 'redwood-import-client') {
    input.source = 'manual'
  }

  if (
    taskSlug === 'redwood-update-client' ||
    taskSlug === 'redwood-inactivate-client' ||
    taskSlug === 'redwood-upload-headshot' ||
    taskSlug === 'redwood-queue-pending-client-updates-nightly' ||
    taskSlug === 'redwood-sync-upcoming-random-testing' ||
    taskSlug === 'redwood-sync-todays-random-testing'
  ) {
    input.requestedByAdminId = requestedByAdminId
  }

  if (
    taskSlug === 'redwood-queue-pending-client-updates-nightly' ||
    taskSlug === 'redwood-sync-upcoming-random-testing' ||
    taskSlug === 'redwood-sync-todays-random-testing'
  ) {
    input.source = 'job-history-retry'
  }

  return input
}

function isActiveJob(job: Record<string, unknown>): boolean {
  return !job.completedAt && job.hasError !== true
}

function assertRetryRuntimeIsEnabled(taskSlug: RetryableJobTaskSlug): void {
  if (taskSlug === 'redwood-sync-upcoming-random-testing' || taskSlug === 'redwood-sync-todays-random-testing') {
    const runtime = getRandomTestingSyncRuntimeState()
    if (!runtime.enabled) {
      throw new Error(
        'Random-testing calendar writes are disabled. Enable the random-testing schedule sync before retrying.',
      )
    }
    if (!runtime.configured) {
      throw new Error(`Random-testing sync is missing: ${runtime.missing.join(', ')}.`)
    }
    return
  }

  const runtime = getRedwoodAutomationRuntimeState()
  if (!runtime.enabled) {
    throw new Error('Redwood automation is disabled. Enable it before retrying this job.')
  }
}

export async function retryFailedJobRun(args: {
  jobRunId: string
  payload: Payload
  req?: PayloadRequest
  requestedByAdminId: string
}): Promise<RetryFailedJobRunResult> {
  const jobRun = (await args.payload.findByID({
    collection: JOB_RUNS_COLLECTION_SLUG,
    id: args.jobRunId,
    depth: 0,
    ...reqOption(args.req),
    overrideAccess: true,
  })) as JobRunRecord

  if (jobRun.status !== 'failed') {
    throw new Error('Only failed jobs can be retried.')
  }

  if (!isRetryableJobTaskSlug(jobRun.taskSlug)) {
    throw new Error(`${getJobTaskLabel(jobRun.taskSlug)} cannot be retried from Job History.`)
  }

  assertRetryRuntimeIsEnabled(jobRun.taskSlug)

  const originalJob = await args.payload
    .findByID({
      collection: 'payload-jobs',
      id: jobRun.jobId,
      depth: 0,
      ...reqOption(args.req),
      overrideAccess: true,
    })
    .catch(() => null)

  if (originalJob && originalJob.hasError !== true) {
    throw new Error('Payload is still running or automatically retrying this job.')
  }

  const queue = jobRun.queue?.trim() || 'default'
  const input = buildRetryInput(jobRun.taskSlug, jobRun.inputSnapshot, args.requestedByAdminId)
  const recentJobs = await args.payload.find({
    collection: 'payload-jobs',
    where: {
      taskSlug: {
        equals: jobRun.taskSlug,
      },
    },
    sort: '-createdAt',
    limit: 25,
    depth: 0,
    ...reqOption(args.req),
    overrideAccess: true,
  })
  const activeRetry = recentJobs.docs.find((job) => {
    const candidate = job as unknown as Record<string, unknown>
    return (
      isActiveJob(candidate) && candidate.queue === queue && isDeepStrictEqual(readSnapshot(candidate.input), input)
    )
  })

  if (activeRetry?.id) {
    return {
      deduplicated: true,
      jobId: String(activeRetry.id),
      taskLabel: jobRun.taskLabel || getJobTaskLabel(jobRun.taskSlug),
    }
  }

  const queueJob = args.payload.jobs.queue as unknown as RetryJobQueue
  const queued = await queueJob({
    task: jobRun.taskSlug,
    queue,
    input,
    meta: {
      retriedByAdminId: args.requestedByAdminId,
      retriedFromJobId: jobRun.jobId,
      retriedFromJobRunId: jobRun.id,
    },
    ...reqOption(args.req),
    overrideAccess: true,
  })
  const jobId = String(queued.id)

  await recordQueuedJobRun(args.payload, {
    input,
    jobId,
    queue,
    requestedByAdminId: args.requestedByAdminId,
    summary: `Retried failed ${jobRun.taskLabel || getJobTaskLabel(jobRun.taskSlug)} job ${jobRun.jobId}.`,
    taskSlug: jobRun.taskSlug,
  })

  return {
    deduplicated: false,
    jobId,
    taskLabel: jobRun.taskLabel || getJobTaskLabel(jobRun.taskSlug),
  }
}
