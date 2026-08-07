import { getPayload, type Payload, type PayloadRequest } from 'payload'

import { recordQueuedJobRun } from '@/lib/jobs/jobRuns'
import { assertRedwoodMutationAllowed, getRedwoodAccountNumber } from '@/lib/redwood/config'
import {
  REDWOOD_SKIP_CLIENT_UPDATE_QUEUE_CONTEXT_KEY,
  REDWOOD_SKIP_PROVISIONING_QUEUE_CONTEXT_KEY,
} from '@/lib/redwood/context'
import { upsertRedwoodIncidentAlert } from '@/lib/redwood/incidents'

export type RedwoodQueueSource =
  | 'frontend-registration'
  | 'admin-registration'
  | 'wizard-registration'
  | 'guided-workflow'
  | 'client-reactivation'
  | 'manual'
export type RedwoodClientUpdateField = 'firstName' | 'middleInitial' | 'lastName' | 'dob' | 'gender' | 'phone'
export type RedwoodDefaultTestSyncQueueOptions = {
  previousSyncedCode?: string | null
}

async function resolvePayload(payload?: Payload): Promise<Payload> {
  if (payload) return payload
  const { default: configPromise } = await import('@payload-config')
  return getPayload({ config: configPromise })
}

function normalizeChangedFields(changedFields: RedwoodClientUpdateField[]): RedwoodClientUpdateField[] {
  return Array.from(new Set(changedFields.map((field) => field.trim()).filter(Boolean))).sort() as RedwoodClientUpdateField[]
}

function reqOption(reqArg?: PayloadRequest): { req: PayloadRequest } | Record<string, never> {
  return reqArg ? { req: reqArg } : {}
}

async function findActiveRedwoodJobId(args: {
  clientId: string
  payload: Payload
  req?: PayloadRequest
  taskSlug: string
}): Promise<string | null> {
  const queuedJobs = await args.payload.find({
    collection: 'payload-jobs',
    where: {
      and: [
        {
          'input.clientId': {
            equals: args.clientId,
          },
        },
        {
          taskSlug: {
            equals: args.taskSlug,
          },
        },
      ],
    },
    sort: '-createdAt',
    limit: 5,
    depth: 0,
    ...reqOption(args.req),
    overrideAccess: true,
  })
  const activeQueuedJob = queuedJobs.docs.find((job) => !job.completedAt && job.hasError !== true)
  if (activeQueuedJob?.id) {
    return String(activeQueuedJob.id)
  }

  // Durable job history is a fallback for deployments created before payload-jobs was queryable here.
  const result = await args.payload.find({
    collection: 'job-runs',
    where: {
      and: [
        {
          client: {
            equals: args.clientId,
          },
        },
        {
          taskSlug: {
            equals: args.taskSlug,
          },
        },
        {
          status: {
            in: ['queued', 'running'],
          },
        },
      ],
    },
    sort: '-createdAt',
    limit: 1,
    depth: 0,
    ...reqOption(args.req),
    overrideAccess: true,
  })
  const jobId = result.docs[0]?.jobId
  return typeof jobId === 'string' && jobId.trim() ? jobId : null
}

export async function queueRedwoodImportForClient(
  clientId: string,
  source: RedwoodQueueSource,
  payloadArg?: Payload,
  reqArg?: PayloadRequest,
): Promise<{ jobId: string; deduplicated?: boolean }> {
  const payload = await resolvePayload(payloadArg)

  try {
    const client = await payload.findByID({
      collection: 'clients',
      id: clientId,
      depth: 0,
      ...reqOption(reqArg),
      overrideAccess: true,
    })

    const accountNumber = getRedwoodAccountNumber()
    const input = {
      clientId,
      source,
    }

    assertRedwoodMutationAllowed(accountNumber, 'import')

    const activeJobId = await findActiveRedwoodJobId({
      clientId,
      payload,
      req: reqArg,
      taskSlug: 'redwood-import-client',
    })
    if (activeJobId) {
      payload.logger.info({
        msg: '[redwood-queue] Reused active redwood-import-client job',
        clientId,
        source,
        queue: 'redwood',
        jobId: activeJobId,
      })

      return { jobId: activeJobId, deduplicated: true }
    }

    const queued = await payload.jobs.queue({
      task: 'redwood-import-client',
      queue: 'redwood',
      input,
      ...reqOption(reqArg),
      overrideAccess: true,
    })
    await recordQueuedJobRun(payload, {
      jobId: queued.id,
      queue: 'redwood',
      taskSlug: 'redwood-import-client',
      input,
    })

    await payload.update({
      collection: 'clients',
      id: client.id,
      data: {
        redwoodSyncStatus: 'queued',
        redwoodLastError: null,
      },
      context: {
        ...(reqArg?.context || {}),
        [REDWOOD_SKIP_PROVISIONING_QUEUE_CONTEXT_KEY]: true,
      },
      ...reqOption(reqArg),
      overrideAccess: true,
    })

    payload.logger.info({
      msg: '[redwood-queue] Queued redwood-import-client',
      clientId,
      source,
      queue: 'redwood',
      jobId: queued.id,
    })

    return { jobId: queued.id }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    await upsertRedwoodIncidentAlert({
      payload,
      clientId,
      jobType: 'import',
      kind: 'business-critical-failure',
      title: `Failed to queue Redwood import for client ${clientId}`,
      message,
      context: {
        clientId,
        source,
        error: message,
      },
    })

    throw error
  }
}

export async function queueRedwoodHeadshotUpload(
  clientId: string,
  requestedByAdminId?: string,
  payloadArg?: Payload,
  reqArg?: PayloadRequest,
): Promise<{ jobId: string; deduplicated?: boolean }> {
  const payload = await resolvePayload(payloadArg)

  try {
    const client = await payload.findByID({
      collection: 'clients',
      id: clientId,
      depth: 0,
      ...reqOption(reqArg),
      overrideAccess: true,
    })
    const donorId = typeof client.redwoodDonorId === 'string' ? client.redwoodDonorId.trim() : ''
    const headshotId =
      typeof client.headshot === 'string'
        ? client.headshot
        : client.headshot && typeof client.headshot === 'object' && 'id' in client.headshot
          ? String(client.headshot.id)
          : ''
    const accountNumber =
      (typeof client.redwoodAccountNumber === 'string' && client.redwoodAccountNumber.trim()) ||
      getRedwoodAccountNumber()
    assertRedwoodMutationAllowed(accountNumber, 'headshot upload')

    if (!donorId) {
      await payload.update({
        collection: 'clients',
        id: client.id,
        data: {
          redwoodHeadshotPushStatus: 'failed',
          redwoodHeadshotPushLastAttemptAt: new Date().toISOString(),
          redwoodHeadshotPushLastError: 'Client is missing Redwood identity; headshot upload was not queued.',
        },
        ...reqOption(reqArg),
        overrideAccess: true,
      })

      throw new Error(
        'Client is missing Redwood donor ID; headshot upload requires completed Redwood donor provisioning.',
      )
    }

    if (!headshotId) {
      throw new Error('Client is missing a website headshot; Redwood headshot upload was not queued.')
    }

    const input = {
      clientId,
      requestedByAdminId: requestedByAdminId || null,
    }

    const activeJobId = await findActiveRedwoodJobId({
      clientId,
      payload,
      req: reqArg,
      taskSlug: 'redwood-upload-headshot',
    })
    if (activeJobId) {
      return { jobId: activeJobId, deduplicated: true }
    }

    const queued = await payload.jobs.queue({
      task: 'redwood-upload-headshot',
      queue: 'redwood',
      input,
      ...reqOption(reqArg),
      overrideAccess: true,
    })
    await recordQueuedJobRun(payload, {
      jobId: queued.id,
      queue: 'redwood',
      taskSlug: 'redwood-upload-headshot',
      input,
    })

    await payload.update({
      collection: 'clients',
      id: client.id,
      data: {
        redwoodHeadshotPushStatus: 'queued',
        redwoodHeadshotPushLastAttemptAt: new Date().toISOString(),
        redwoodHeadshotPushLastError: null,
      },
      ...reqOption(reqArg),
      overrideAccess: true,
    })

    payload.logger.info({
      msg: '[redwood-queue] Queued redwood-upload-headshot',
      clientId,
      requestedByAdminId,
      queue: 'redwood',
      jobId: queued.id,
    })

    return { jobId: queued.id }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    await upsertRedwoodIncidentAlert({
      payload,
      clientId,
      jobType: 'headshot-upload',
      kind: 'business-critical-failure',
      title: `Failed to queue Redwood headshot upload for client ${clientId}`,
      message,
      context: {
        clientId,
        requestedByAdminId,
        error: message,
      },
    })

    throw error
  }
}

export async function queueRedwoodClientUpdate(
  clientId: string,
  changedFields: RedwoodClientUpdateField[],
  requestedByAdminId?: string,
  payloadArg?: Payload,
  reqArg?: PayloadRequest,
): Promise<{ jobId: string }> {
  const payload = await resolvePayload(payloadArg)

  try {
    const triggeredFields = normalizeChangedFields(changedFields)
    if (triggeredFields.length === 0) {
      throw new Error('Redwood client update was not queued because no syncable fields changed.')
    }

    const accountNumber = getRedwoodAccountNumber()
    assertRedwoodMutationAllowed(accountNumber, 'client update')
    const syncFields = triggeredFields
    const input = {
      clientId,
      changedFieldsCsv: syncFields.join(','),
      requestedByAdminId: requestedByAdminId || null,
    }

    const queued = await payload.jobs.queue({
      task: 'redwood-update-client',
      queue: 'redwood',
      input,
      ...reqOption(reqArg),
      overrideAccess: true,
    })
    await recordQueuedJobRun(payload, {
      jobId: queued.id,
      queue: 'redwood',
      taskSlug: 'redwood-update-client',
      input,
    })

    await payload.update({
      collection: 'clients',
      id: clientId,
      data: {
        redwoodClientUpdateStatus: 'queued',
        redwoodClientUpdateLastAttemptAt: new Date().toISOString(),
        redwoodClientUpdateLastError: null,
      },
      // This bookkeeping write can share the originating request context. Prevent it
      // from being interpreted as another client edit and recursively queueing jobs.
      context: {
        ...(reqArg?.context || {}),
        [REDWOOD_SKIP_CLIENT_UPDATE_QUEUE_CONTEXT_KEY]: true,
      },
      ...reqOption(reqArg),
      overrideAccess: true,
    })

    payload.logger.info({
      msg: '[redwood-queue] Queued redwood-update-client',
      clientId,
      changedFields: syncFields,
      triggeredFields,
      requestedByAdminId,
      queue: 'redwood',
      jobId: queued.id,
    })

    return { jobId: queued.id }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    await upsertRedwoodIncidentAlert({
      payload,
      clientId,
      jobType: 'client-update',
      kind: 'business-critical-failure',
      title: `Failed to queue Redwood client update for client ${clientId}`,
      message,
      context: {
        clientId,
        changedFields,
        requestedByAdminId,
        error: message,
      },
    })

    throw error
  }
}

export async function queueRedwoodDefaultTestSync(
  clientId: string,
  payloadArg?: Payload,
  reqArg?: PayloadRequest,
  options?: RedwoodDefaultTestSyncQueueOptions,
): Promise<{ jobId: string; deduplicated?: boolean }> {
  const payload = await resolvePayload(payloadArg)

  try {
    const accountNumber = getRedwoodAccountNumber()
    assertRedwoodMutationAllowed(accountNumber, 'default test sync')
    const previousSyncedCode = options?.previousSyncedCode?.trim()
    const input = previousSyncedCode
      ? {
          clientId,
          previousSyncedCode,
        }
      : {
          clientId,
        }

    const activeJobId = await findActiveRedwoodJobId({
      clientId,
      payload,
      req: reqArg,
      taskSlug: 'redwood-sync-default-test',
    })
    if (activeJobId) {
      return { jobId: activeJobId, deduplicated: true }
    }

    const queued = await payload.jobs.queue({
      task: 'redwood-sync-default-test',
      queue: 'redwood',
      input,
      ...reqOption(reqArg),
      overrideAccess: true,
    })
    await recordQueuedJobRun(payload, {
      jobId: queued.id,
      queue: 'redwood',
      taskSlug: 'redwood-sync-default-test',
      input,
    })

    payload.logger.info({
      msg: '[redwood-queue] Queued redwood-sync-default-test',
      clientId,
      queue: 'redwood',
      jobId: queued.id,
    })

    return { jobId: queued.id }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    await upsertRedwoodIncidentAlert({
      payload,
      clientId,
      jobType: 'default-test-sync',
      kind: 'business-critical-failure',
      title: `Failed to queue Redwood default-test sync for client ${clientId}`,
      message,
      context: {
        clientId,
        error: message,
      },
    })

    throw error
  }
}

export async function queueRedwoodClientInactivation(
  clientId: string,
  requestedByAdminId?: string,
  payloadArg?: Payload,
  reqArg?: PayloadRequest,
): Promise<{ jobId: string }> {
  const payload = await resolvePayload(payloadArg)

  try {
    const client = await payload.findByID({
      collection: 'clients',
      id: clientId,
      depth: 0,
      ...reqOption(reqArg),
      overrideAccess: true,
    })
    const donorId = typeof client.redwoodDonorId === 'string' ? client.redwoodDonorId.trim() : ''
    const accountNumber =
      (typeof client.redwoodAccountNumber === 'string' && client.redwoodAccountNumber.trim()) ||
      getRedwoodAccountNumber()

    assertRedwoodMutationAllowed(accountNumber, 'client inactivation')

    if (!donorId) {
      await payload.update({
        collection: 'clients',
        id: client.id,
        data: {
          redwoodInactivationStatus: 'failed',
          redwoodInactivationLastAttemptAt: new Date().toISOString(),
          redwoodInactivationLastError: 'Client is missing Redwood identity; inactivation was not queued.',
        },
        ...reqOption(reqArg),
        overrideAccess: true,
      })

      throw new Error('Client is missing Redwood donor ID; inactivation requires redwoodDonorId.')
    }

    const input = {
      clientId,
      requestedByAdminId: requestedByAdminId || null,
    }

    const queued = await payload.jobs.queue({
      task: 'redwood-inactivate-client',
      queue: 'redwood',
      input,
      ...reqOption(reqArg),
      overrideAccess: true,
    })
    await recordQueuedJobRun(payload, {
      jobId: queued.id,
      queue: 'redwood',
      taskSlug: 'redwood-inactivate-client',
      input,
    })

    await payload.update({
      collection: 'clients',
      id: client.id,
      data: {
        redwoodInactivationStatus: 'queued',
        redwoodInactivationLastAttemptAt: new Date().toISOString(),
        redwoodInactivationLastError: null,
      },
      ...reqOption(reqArg),
      overrideAccess: true,
    })

    payload.logger.info({
      msg: '[redwood-queue] Queued redwood-inactivate-client',
      clientId,
      requestedByAdminId,
      queue: 'redwood',
      jobId: queued.id,
    })

    return { jobId: queued.id }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    await upsertRedwoodIncidentAlert({
      payload,
      clientId,
      jobType: 'client-inactivation',
      kind: 'business-critical-failure',
      title: `Failed to queue Redwood inactivation for client ${clientId}`,
      message,
      context: {
        clientId,
        requestedByAdminId,
        error: message,
      },
    })

    throw error
  }
}
