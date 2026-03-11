import Link from 'next/link'
import { formatDistanceToNowStrict } from 'date-fns'
import type { WidgetServerProps, Where } from 'payload'

import { ShadcnWrapper } from '@/components/ShadcnWrapper'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { JOB_RUNS_COLLECTION_SLUG, getJobTaskLabel, type JobRunRecord, type JobRunStatus } from '@/lib/jobs/jobRuns'
import type { PayloadJob } from '@/payload-types'
import { cn } from '@/utilities/cn'
import { ActiveJobsWidgetClient, type ActiveDashboardJob } from './ActiveJobsWidget.client'

const ACTIVE_JOB_LIMIT = 8
const JOB_HISTORY_LIMIT = 6

type RecentDashboardJobRun = {
  clientId?: string
  completedLabel: string
  errorMessage?: string
  jobId: string
  requestedByAdminId?: string
  resultStatus?: string
  status: JobRunStatus
  summary?: string
  taskLabel: string
}

function getActiveJobWhere(processing?: boolean): Where {
  const and: Where[] = [
    {
      hasError: {
        not_equals: true,
      },
    },
    {
      completedAt: {
        equals: null,
      },
    },
  ]

  if (typeof processing === 'boolean') {
    and.push({
      processing: {
        equals: processing,
      },
    })
  }

  return { and }
}

function getRecentJobHistoryWhere(): Where {
  return {
    status: {
      in: ['cancelled', 'failed', 'manual-review', 'succeeded'],
    },
  }
}

function readRecord(value: unknown): null | Record<string, unknown> {
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    return null
  }

  return value as Record<string, unknown>
}

function readString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }

  const trimmed = value.trim()
  return trimmed || undefined
}

function readJobInput(job: PayloadJob): Record<string, unknown> | null {
  return readRecord(job.input)
}

function summarizeJob(job: PayloadJob): ActiveDashboardJob {
  const input = readJobInput(job)

  return {
    ageLabel: formatDistanceToNowStrict(new Date(job.createdAt), { addSuffix: true }),
    clientId: readString(input?.clientId),
    createdAt: job.createdAt,
    id: String(job.id),
    processing: job.processing === true,
    queue: job.queue || 'default',
    requestedByAdminId: readString(input?.requestedByAdminId),
    taskLabel: getJobTaskLabel(job.taskSlug || ''),
    taskSlug: job.taskSlug || 'unknown',
    totalTried: job.totalTried,
  }
}

function readRelationshipId(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value
  }

  const record = readRecord(value)
  return readString(record?.id)
}

function summarizeHistory(jobRun: JobRunRecord): RecentDashboardJobRun {
  const completedAt = jobRun.completedAt || jobRun.updatedAt || jobRun.createdAt

  return {
    clientId: readRelationshipId(jobRun.client),
    completedLabel: formatDistanceToNowStrict(new Date(completedAt), { addSuffix: true }),
    errorMessage: readString(jobRun.errorMessage),
    jobId: jobRun.jobId,
    requestedByAdminId: readRelationshipId(jobRun.requestedByAdmin),
    resultStatus: readString(jobRun.resultStatus),
    status: jobRun.status,
    summary: readString(jobRun.summary),
    taskLabel: jobRun.taskLabel || getJobTaskLabel(jobRun.taskSlug),
  }
}

function getHistoryBadgeVariant(status: JobRunStatus): 'destructive' | 'outline' | 'success' | 'warning' {
  switch (status) {
    case 'succeeded':
      return 'success'
    case 'manual-review':
      return 'warning'
    case 'cancelled':
      return 'outline'
    case 'failed':
    default:
      return 'destructive'
  }
}

function getHistoryStatusLabel(status: JobRunStatus): string {
  switch (status) {
    case 'manual-review':
      return 'Manual Review'
    case 'succeeded':
      return 'Succeeded'
    case 'cancelled':
      return 'Cancelled'
    case 'failed':
      return 'Failed'
    case 'queued':
      return 'Queued'
    case 'running':
      return 'Running'
  }
}

export default async function ActiveJobsWidget({ req }: WidgetServerProps) {
  if (!req.user || req.user.collection !== 'admins') {
    return null
  }

  let jobs: ActiveDashboardJob[] = []
  let history: RecentDashboardJobRun[] = []
  let activeCount = 0
  let queuedCount = 0
  let runningCount = 0
  let activeLoadError = false
  let historyLoadError = false

  try {
    const [activeJobs, queuedJobs, runningJobs] = await Promise.all([
      req.payload.find({
        collection: 'payload-jobs',
        where: getActiveJobWhere(),
        sort: '-createdAt',
        limit: ACTIVE_JOB_LIMIT,
        depth: 0,
        overrideAccess: true,
      }),
      req.payload.count({
        collection: 'payload-jobs',
        where: getActiveJobWhere(false),
        overrideAccess: true,
      }),
      req.payload.count({
        collection: 'payload-jobs',
        where: getActiveJobWhere(true),
        overrideAccess: true,
      }),
    ])

    jobs = activeJobs.docs.map((job) => summarizeJob(job as PayloadJob))
    activeCount = activeJobs.totalDocs
    queuedCount = queuedJobs.totalDocs
    runningCount = runningJobs.totalDocs
  } catch (error) {
    activeLoadError = true
    req.payload.logger.error({ err: error, msg: 'Failed to load active jobs dashboard widget' })
  }

  try {
    const recentRuns = await req.payload.find({
      collection: JOB_RUNS_COLLECTION_SLUG as never,
      where: getRecentJobHistoryWhere(),
      sort: '-completedAt',
      limit: JOB_HISTORY_LIMIT,
      depth: 0,
      overrideAccess: true,
    })

    history = recentRuns.docs.map((doc) => summarizeHistory(doc as JobRunRecord))
  } catch (error) {
    historyLoadError = true
    req.payload.logger.error({ err: error, msg: 'Failed to load job history dashboard widget' })
  }

  const showingCount = jobs.length
  const canCancel = req.user.role === 'superAdmin'

  return (
    <ShadcnWrapper className="pb-0">
      <Card variant="admin">
        <CardHeader className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>Active Jobs</CardTitle>
              <CardDescription>Live queue health plus durable Redwood job history.</CardDescription>
            </div>
            <Link
              href="/admin/collections/job-runs"
              className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }), 'shrink-0')}
            >
              Open Job History
            </Link>
          </div>

          {!activeLoadError && (
            <div className="grid grid-cols-3 gap-2">
              <div className="border-border/70 bg-background/40 rounded-md border px-3 py-2">
                <p className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">Active</p>
                <p className="mt-1 text-xl font-semibold tabular-nums">{activeCount}</p>
              </div>
              <div className="border-border/70 bg-background/40 rounded-md border px-3 py-2">
                <p className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">Running</p>
                <p className="mt-1 text-xl font-semibold tabular-nums">{runningCount}</p>
              </div>
              <div className="border-border/70 bg-background/40 rounded-md border px-3 py-2">
                <p className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">Queued</p>
                <p className="mt-1 text-xl font-semibold tabular-nums">{queuedCount}</p>
              </div>
            </div>
          )}
        </CardHeader>

        <CardContent className="space-y-6">
          <section className="space-y-4">
            {activeLoadError ? (
              <p className="text-muted-foreground text-sm">Unable to load active job data right now.</p>
            ) : (
              <>
                {activeCount > showingCount && (
                  <div className="text-muted-foreground flex items-center gap-2 text-sm">
                    <Badge variant="outline">Showing {showingCount}</Badge>
                    <span>Newest active jobs only. Refresh to keep queue state current.</span>
                  </div>
                )}
                <ActiveJobsWidgetClient canCancel={canCancel} jobs={jobs} />
                {!canCancel && jobs.length > 0 && (
                  <p className="text-muted-foreground text-xs">
                    Admins can monitor queue health here. Super-admins can cancel stuck jobs directly.
                  </p>
                )}
              </>
            )}
          </section>

          <section className="space-y-4 border-t border-border/60 pt-4">
            <div>
              <h3 className="text-sm font-semibold">Recent History</h3>
              <p className="text-muted-foreground text-sm">Tracked Redwood job outcomes stay here after the queue clears.</p>
            </div>

            {historyLoadError ? (
              <p className="text-muted-foreground text-sm">Unable to load recent job history right now.</p>
            ) : history.length === 0 ? (
              <div className="border-border/80 bg-background/60 text-muted-foreground rounded-xl border border-dashed p-4 text-sm">
                No tracked Redwood job history yet.
              </div>
            ) : (
              <div className="space-y-3">
                {history.map((jobRun) => (
                  <div key={jobRun.jobId} className="border-border/70 bg-background/70 rounded-xl border p-4">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={getHistoryBadgeVariant(jobRun.status)}>
                          {getHistoryStatusLabel(jobRun.status)}
                        </Badge>
                        {jobRun.resultStatus && <Badge variant="secondary">{jobRun.resultStatus}</Badge>}
                        <p className="text-sm font-semibold">{jobRun.taskLabel}</p>
                      </div>

                      <div className="text-muted-foreground grid gap-1 text-sm">
                        <p>Job ID: {jobRun.jobId}</p>
                        {jobRun.clientId && <p>Client: {jobRun.clientId}</p>}
                        {jobRun.requestedByAdminId && <p>Requested by admin: {jobRun.requestedByAdminId}</p>}
                        <p>{jobRun.completedLabel}</p>
                        {jobRun.summary && <p className="text-foreground/90">{jobRun.summary}</p>}
                        {jobRun.errorMessage && <p className="text-destructive">{jobRun.errorMessage}</p>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </CardContent>
      </Card>
    </ShadcnWrapper>
  )
}
