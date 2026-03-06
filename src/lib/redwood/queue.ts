import { getPayload, type Payload } from 'payload'

import { createAdminAlert } from '@/lib/admin-alerts'
import { buildRedwoodUniqueId } from '@/lib/redwood/unique-id'

export type RedwoodQueueSource = 'frontend-registration' | 'admin-registration' | 'wizard-registration' | 'manual'

async function resolvePayload(payload?: Payload): Promise<Payload> {
  if (payload) return payload
  const { default: configPromise } = await import('@payload-config')
  return getPayload({ config: configPromise })
}

export async function queueRedwoodImportForClient(
  clientId: string,
  source: RedwoodQueueSource,
  payloadArg?: Payload,
): Promise<{ jobId: string }> {
  const payload = await resolvePayload(payloadArg)

  try {
    const client = await payload.findByID({
      collection: 'clients',
      id: clientId,
      depth: 0,
      overrideAccess: true,
    })

    const existingUniqueId = typeof client.redwoodUniqueId === 'string' ? client.redwoodUniqueId.trim() : ''
    const uniqueId = existingUniqueId || buildRedwoodUniqueId(client.id)

    const queued = await payload.jobs.queue({
      task: 'redwood-import-client',
      queue: 'redwood',
      input: {
        clientId,
        source,
      },
      overrideAccess: true,
    })

    await payload.update({
      collection: 'clients',
      id: client.id,
      data: {
        redwoodUniqueId: uniqueId,
        redwoodSyncStatus: 'queued',
        redwoodLastError: null,
      },
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

    await createAdminAlert(payload, {
      severity: 'high',
      alertType: 'data-integrity',
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

export async function queueRedwoodHeadshotSync(
  clientId: string,
  requestedByAdminId?: string,
  payloadArg?: Payload,
): Promise<{ jobId: string }> {
  const payload = await resolvePayload(payloadArg)

  try {
    const queued = await payload.jobs.queue({
      task: 'redwood-sync-headshot',
      queue: 'redwood',
      input: {
        clientId,
        requestedByAdminId: requestedByAdminId || null,
      },
      overrideAccess: true,
    })

    payload.logger.info({
      msg: '[redwood-queue] Queued redwood-sync-headshot',
      clientId,
      requestedByAdminId,
      queue: 'redwood',
      jobId: queued.id,
    })

    return { jobId: queued.id }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    await createAdminAlert(payload, {
      severity: 'high',
      alertType: 'data-integrity',
      title: `Failed to queue Redwood headshot sync for client ${clientId}`,
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
