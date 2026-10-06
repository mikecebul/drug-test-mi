import type { Where } from 'payload'

import { APP_TIMEZONE } from '@/lib/date-utils'
import type { PayloadJob } from '@/payload-types'

export type ActiveJobStatus = 'queued' | 'running' | 'scheduled'
type JobTiming = Pick<PayloadJob, 'processing' | 'waitUntil'>

export function getActiveJobStatus(job: JobTiming, now: Date): ActiveJobStatus {
  if (job.processing) return 'running'
  if (job.waitUntil && Date.parse(job.waitUntil) > now.getTime()) return 'scheduled'
  return 'queued'
}

export function formatJobWaitUntil(waitUntil: string | null | undefined): string | undefined {
  if (!waitUntil || !Number.isFinite(Date.parse(waitUntil))) return undefined
  return new Intl.DateTimeFormat('en-US', {
    timeZone: APP_TIMEZONE,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(new Date(waitUntil))
}

export function getActiveJobWhere(status?: ActiveJobStatus, now = new Date()): Where {
  const and: Where[] = [{ hasError: { not_equals: true } }, { completedAt: { equals: null } }]

  if (status) {
    and.push({ processing: { equals: status === 'running' } })
  }
  if (status === 'scheduled') {
    and.push({ waitUntil: { greater_than: now.toISOString() } })
  } else if (status === 'queued') {
    and.push({
      or: [{ waitUntil: { equals: null } }, { waitUntil: { less_than_equal: now.toISOString() } }],
    })
  }

  return { and }
}
