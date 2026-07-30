'use server'

import configPromise from '@payload-config'
import { addDays } from 'date-fns'
import { headers } from 'next/headers'
import { getPayload, type Payload } from 'payload'

import { recordQueuedJobRun } from '@/lib/jobs/jobRuns'
import { getRandomTestingStart, getValidatedRandomTestingCalcomEventType } from '@/lib/random-testing/calcom'
import { getRandomTestingSyncRuntimeState } from '@/lib/random-testing/runtime'
import {
  previewTodaysScheduledCollections,
  type TodaysScheduledCollectionPreview,
} from '@/lib/random-testing/todays-schedule'
import { fetchUpcomingScheduledCollections } from '@/lib/redwood/upcoming-scheduled-collections'
import { listGoogleCalendarEvents } from '@/utilities/google-calendar-api'

type RandomTestingSyncKind = 'today' | 'upcoming'

type ServiceCheck = {
  detail: string
  name: 'Cal.com' | 'Google Calendar' | 'ToxAccess'
  success: boolean
}

export type RandomTestingConnectionCheckResult = {
  checkedAt: string
  error?: string
  services: ServiceCheck[]
  success: boolean
}

export type RandomTestingPreviewResult = {
  collections?: TodaysScheduledCollectionPreview[]
  error?: string
  success: boolean
}

export type RandomTestingQueueResult = {
  deduplicated?: boolean
  error?: string
  jobId?: string
  kind?: RandomTestingSyncKind
  success: boolean
}

async function getAdminPayload(options?: { superAdmin?: boolean }) {
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: await headers() })

  if (!user || user.collection !== 'admins') {
    throw new Error('Unauthorized: admin access required.')
  }
  if (options?.superAdmin && user.role !== 'superAdmin') {
    throw new Error('Unauthorized: super-admin access required to queue a calendar sync.')
  }

  return { payload, user }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

async function checkToxAccess(): Promise<{
  collectionDate?: string
  service: ServiceCheck
}> {
  try {
    const days = await fetchUpcomingScheduledCollections()
    const total = days.reduce((sum, day) => sum + day.total, 0)
    return {
      collectionDate: days[0]?.collectionDate,
      service: {
        name: 'ToxAccess',
        success: true,
        detail: `${total} upcoming collection${total === 1 ? '' : 's'} across ${days.length} day${days.length === 1 ? '' : 's'}.`,
      },
    }
  } catch (error) {
    return {
      service: {
        name: 'ToxAccess',
        success: false,
        detail: errorMessage(error),
      },
    }
  }
}

function localDate(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Detroit',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

async function checkCalcom(collectionDate: string): Promise<ServiceCheck> {
  try {
    const [timing, eventType] = await Promise.all([
      getRandomTestingStart({ collectionDate, slotIndex: 0 }),
      getValidatedRandomTestingCalcomEventType(),
    ])
    return {
      name: 'Cal.com',
      success: true,
      detail: `Event ${eventType.id} is unpaid and ${eventType.lengthInMinutes} minutes on schedule ${eventType.scheduleId}. First slot for ${collectionDate}: ${new Date(
        timing.start,
      ).toLocaleString('en-US', {
        timeZone: timing.timeZone,
      })}.`,
    }
  } catch (error) {
    return {
      name: 'Cal.com',
      success: false,
      detail: errorMessage(error),
    }
  }
}

async function checkGoogleCalendar(now = new Date()): Promise<ServiceCheck> {
  try {
    const events = await listGoogleCalendarEvents({
      timeMin: now.toISOString(),
      timeMax: addDays(now, 15).toISOString(),
      privateExtendedProperties: ['source=toxaccess-random-testing'],
    })
    return {
      name: 'Google Calendar',
      success: true,
      detail: `Calendar is readable; found ${events.length} random-testing event${events.length === 1 ? '' : 's'} in the next 15 days.`,
    }
  } catch (error) {
    return {
      name: 'Google Calendar',
      success: false,
      detail: errorMessage(error),
    }
  }
}

export async function checkRandomTestingConnections(): Promise<RandomTestingConnectionCheckResult> {
  try {
    await getAdminPayload()
    const toxAccess = await checkToxAccess()
    const collectionDate = toxAccess.collectionDate || localDate()
    const [calcom, googleCalendar] = await Promise.all([checkCalcom(collectionDate), checkGoogleCalendar()])
    const services = [toxAccess.service, calcom, googleCalendar]

    return {
      checkedAt: new Date().toISOString(),
      services,
      success: services.every((service) => service.success),
    }
  } catch (error) {
    return {
      checkedAt: new Date().toISOString(),
      error: errorMessage(error),
      services: [],
      success: false,
    }
  }
}

export async function previewRandomTestingToday(): Promise<RandomTestingPreviewResult> {
  try {
    const { payload } = await getAdminPayload()
    return {
      success: true,
      collections: await previewTodaysScheduledCollections(payload),
    }
  } catch (error) {
    return {
      success: false,
      error: errorMessage(error),
    }
  }
}

function taskForKind(kind: RandomTestingSyncKind) {
  return kind === 'upcoming'
    ? ('redwood-sync-upcoming-random-testing' as const)
    : ('redwood-sync-todays-random-testing' as const)
}

async function findActiveJob(payload: Payload, taskSlug: string): Promise<string | null> {
  const jobs = await payload.find({
    collection: 'payload-jobs',
    where: {
      taskSlug: {
        equals: taskSlug,
      },
    },
    sort: '-createdAt',
    limit: 5,
    depth: 0,
    overrideAccess: true,
  })
  const active = jobs.docs.find(
    (job) =>
      !job.completedAt &&
      job.hasError !== true &&
      typeof job.input === 'object' &&
      job.input !== null &&
      'source' in job.input &&
      job.input.source === 'admin-dashboard',
  )
  return active?.id ? String(active.id) : null
}

export async function queueRandomTestingSync(kind: RandomTestingSyncKind): Promise<RandomTestingQueueResult> {
  try {
    const { payload, user } = await getAdminPayload({ superAdmin: true })
    const runtime = getRandomTestingSyncRuntimeState()
    if (!runtime.enabled) {
      throw new Error(
        'Random-testing calendar writes are disabled. Set RANDOM_TESTING_SCHEDULE_SYNC_ENABLED=true after the connection check passes.',
      )
    }
    if (!runtime.configured) {
      throw new Error(`Random-testing sync is missing: ${runtime.missing.join(', ')}.`)
    }

    const taskSlug = taskForKind(kind)
    const activeJobId = await findActiveJob(payload, taskSlug)
    if (activeJobId) {
      return {
        success: true,
        deduplicated: true,
        jobId: activeJobId,
        kind,
      }
    }

    const input = {
      requestedByAdminId: String(user.id),
      source: 'admin-dashboard',
    }
    const queued = await payload.jobs.queue({
      task: taskSlug,
      queue: 'redwood',
      input,
      overrideAccess: true,
    })
    const jobId = String(queued.id)

    await recordQueuedJobRun(payload, {
      input,
      jobId,
      queue: 'redwood',
      summary:
        kind === 'upcoming'
          ? 'Manually queued upcoming random-testing calendar holds.'
          : 'Manually queued today’s random-testing schedule.',
      taskSlug,
    })

    return {
      success: true,
      jobId,
      kind,
    }
  } catch (error) {
    return {
      success: false,
      error: errorMessage(error),
    }
  }
}
