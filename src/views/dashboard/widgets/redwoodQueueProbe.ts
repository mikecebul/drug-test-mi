'use server'

import configPromise from '@payload-config'
import { randomUUID } from 'node:crypto'
import { hostname } from 'node:os'
import { headers } from 'next/headers'
import { getPayload, type Payload } from 'payload'

import { JOB_RUNS_COLLECTION_SLUG, recordQueuedJobRun } from '@/lib/jobs/jobRuns'
import { getRedwoodAutomationRuntimeState } from '@/lib/redwood/config'

export type RedwoodQueueProbePhase = 'cancelled' | 'failed' | 'missing' | 'queued' | 'running' | 'succeeded'

export type RedwoodQueueProbeResult = {
  automationConfigured?: boolean
  automationConfiguredValue?: string | null
  automationEnabled?: boolean
  error?: string
  jobId?: string
  nodeEnv?: string | null
  phase?: RedwoodQueueProbePhase
  probeId?: string
  processedAt?: string
  success: boolean
  summary?: string
  webHostname?: string
  workerHostname?: string
}

type ProbeSnapshot = {
  processedAt?: unknown
  probeId?: unknown
  webHostname?: unknown
  workerHostname?: unknown
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function readProbeSnapshot(value: unknown): ProbeSnapshot {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as ProbeSnapshot) : {}
}

async function getAdminPayload() {
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: await headers() })

  if (!user || user.collection !== 'admins') {
    throw new Error('Unauthorized: admin access required.')
  }

  return { payload, user }
}

export async function queueRedwoodQueueProbe(): Promise<RedwoodQueueProbeResult> {
  let payloadForLogging: Payload | undefined

  try {
    const { payload, user } = await getAdminPayload()
    payloadForLogging = payload
    const probeId = randomUUID()
    const webHostname = hostname()
    const runtimeState = getRedwoodAutomationRuntimeState()
    const input = {
      probeId,
      requestedByAdminId: String(user.id),
      webHostname,
    }
    const queued = await payload.jobs.queue({
      task: 'redwood-diagnostics-probe',
      queue: 'redwood',
      input,
      overrideAccess: true,
    })

    await recordQueuedJobRun(payload, {
      jobId: String(queued.id),
      queue: 'redwood',
      taskSlug: 'redwood-diagnostics-probe',
      input,
      summary: `Queue probe ${probeId} created by website ${webHostname}.`,
    })

    payload.logger.info({
      msg: '[redwood-diagnostics] Queue probe created by website',
      jobId: String(queued.id),
      probeId,
      requestedByAdminId: String(user.id),
      webHostname,
      automationConfigured: runtimeState.configured,
      automationConfiguredValue: runtimeState.configuredValue,
      automationEnabled: runtimeState.enabled,
      nodeEnv: runtimeState.nodeEnv,
    })

    return {
      success: true,
      phase: 'queued',
      jobId: String(queued.id),
      probeId,
      webHostname,
      automationConfigured: runtimeState.configured,
      automationConfiguredValue: runtimeState.configuredValue,
      automationEnabled: runtimeState.enabled,
      nodeEnv: runtimeState.nodeEnv,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to queue Redwood diagnostic probe.'

    payloadForLogging?.logger.error({
      msg: '[redwood-diagnostics] Website failed to queue probe',
      error: errorMessage,
    })

    return {
      success: false,
      error: errorMessage,
    }
  }
}

export async function getRedwoodQueueProbeStatus(jobId: string): Promise<RedwoodQueueProbeResult> {
  try {
    if (!jobId.trim()) {
      return { success: false, error: 'Job ID is required.' }
    }

    const { payload } = await getAdminPayload()
    const runtimeState = getRedwoodAutomationRuntimeState()
    const runtimeDetails = {
      automationConfigured: runtimeState.configured,
      automationConfiguredValue: runtimeState.configuredValue,
      automationEnabled: runtimeState.enabled,
      nodeEnv: runtimeState.nodeEnv,
    }
    const [historyResult, payloadJob] = await Promise.all([
      payload.find({
        collection: JOB_RUNS_COLLECTION_SLUG,
        where: { jobId: { equals: jobId } },
        sort: '-updatedAt',
        limit: 1,
        depth: 0,
        overrideAccess: true,
      }),
      payload
        .findByID({
          collection: 'payload-jobs',
          id: jobId,
          depth: 0,
          overrideAccess: true,
        })
        .catch(() => null),
    ])
    const history = historyResult.docs[0]

    if (history) {
      const output = readProbeSnapshot(history.outputSnapshot)
      const input = readProbeSnapshot(history.inputSnapshot)
      return {
        ...runtimeDetails,
        success: true,
        phase: history.status as RedwoodQueueProbePhase,
        jobId,
        probeId: readString((history.inputSnapshot as Record<string, unknown> | null)?.probeId),
        processedAt: readString(output.processedAt),
        summary: readString(history.summary),
        webHostname: readString(input.webHostname),
        workerHostname: readString(output.workerHostname),
      }
    }

    if (payloadJob) {
      return {
        ...runtimeDetails,
        success: true,
        phase: payloadJob.hasError ? 'failed' : payloadJob.completedAt ? 'succeeded' : payloadJob.processing ? 'running' : 'queued',
        jobId,
        summary: 'Payload job exists, but no durable Job History row was found.',
      }
    }

    return {
      ...runtimeDetails,
      success: true,
      phase: 'missing',
      jobId,
      summary: 'Neither Payload Jobs nor Job History contains this probe.',
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to read Redwood diagnostic probe status.',
    }
  }
}
