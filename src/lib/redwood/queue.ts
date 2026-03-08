import { getPayload, type Payload } from 'payload'

import { createAdminAlert } from '@/lib/admin-alerts'
import { assertRedwoodMutationAllowed, getRedwoodAccountNumber } from '@/lib/redwood/config'
import { buildRedwoodUniqueId } from '@/lib/redwood/unique-id'

export type RedwoodQueueSource = 'frontend-registration' | 'admin-registration' | 'wizard-registration' | 'manual'
export type RedwoodClientUpdateField = 'firstName' | 'middleInitial' | 'lastName' | 'dob' | 'gender' | 'phone'
const REDWOOD_CLIENT_UPDATE_ALL_FIELDS: RedwoodClientUpdateField[] = [
  'dob',
  'firstName',
  'gender',
  'lastName',
  'middleInitial',
  'phone',
]

async function resolvePayload(payload?: Payload): Promise<Payload> {
  if (payload) return payload
  const { default: configPromise } = await import('@payload-config')
  return getPayload({ config: configPromise })
}

function normalizeChangedFields(changedFields: RedwoodClientUpdateField[]): RedwoodClientUpdateField[] {
  return Array.from(new Set(changedFields.map((field) => field.trim()).filter(Boolean))).sort() as RedwoodClientUpdateField[]
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
    const accountNumber = getRedwoodAccountNumber()

    assertRedwoodMutationAllowed(accountNumber, 'import')

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

export async function queueRedwoodUniqueIdBackfill(
  clientId: string,
  requestedByAdminId?: string,
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
    const accountNumber = getRedwoodAccountNumber()
    const uniqueId = typeof client.redwoodUniqueId === 'string' && client.redwoodUniqueId.trim()
      ? client.redwoodUniqueId.trim()
      : buildRedwoodUniqueId(client.id)

    assertRedwoodMutationAllowed(accountNumber, 'unique ID backfill')

    const queued = await payload.jobs.queue({
      task: 'redwood-backfill-client-unique-id',
      queue: 'redwood',
      input: {
        clientId,
        requestedByAdminId: requestedByAdminId || null,
      },
      overrideAccess: true,
    })

    await payload.update({
      collection: 'clients',
      id: client.id,
      data: {
        redwoodUniqueId: uniqueId,
        redwoodUniqueIdSyncStatus: 'queued',
        redwoodUniqueIdLastAttemptAt: new Date().toISOString(),
        redwoodUniqueIdLastError: null,
      },
      overrideAccess: true,
    })

    payload.logger.info({
      msg: '[redwood-queue] Queued redwood-backfill-client-unique-id',
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
      title: `Failed to queue Redwood unique ID backfill for client ${clientId}`,
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

export async function queueRedwoodHeadshotUpload(
  clientId: string,
  requestedByAdminId?: string,
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
    const uniqueId = typeof client.redwoodUniqueId === 'string' ? client.redwoodUniqueId.trim() : ''
    const donorId = typeof client.redwoodDonorId === 'string' ? client.redwoodDonorId.trim() : ''
    const headshotId =
      typeof client.headshot === 'string'
        ? client.headshot
        : client.headshot && typeof client.headshot === 'object' && 'id' in client.headshot
          ? String(client.headshot.id)
          : ''
    const accountNumber = getRedwoodAccountNumber()

    assertRedwoodMutationAllowed(accountNumber, 'headshot upload')

    if (!uniqueId && !donorId) {
      await payload.update({
        collection: 'clients',
        id: client.id,
        data: {
          redwoodHeadshotPushStatus: 'failed',
          redwoodHeadshotPushLastAttemptAt: new Date().toISOString(),
          redwoodHeadshotPushLastError: 'Client is missing Redwood identity; headshot upload was not queued.',
        },
        overrideAccess: true,
      })

      throw new Error('Client is missing Redwood identity; headshot upload requires redwoodUniqueId or redwoodDonorId.')
    }

    if (!headshotId) {
      throw new Error('Client is missing a website headshot; Redwood headshot upload was not queued.')
    }

    const queued = await payload.jobs.queue({
      task: 'redwood-upload-headshot',
      queue: 'redwood',
      input: {
        clientId,
        requestedByAdminId: requestedByAdminId || null,
      },
      overrideAccess: true,
    })

    await payload.update({
      collection: 'clients',
      id: client.id,
      data: {
        redwoodHeadshotPushStatus: 'queued',
        redwoodHeadshotPushLastAttemptAt: new Date().toISOString(),
        redwoodHeadshotPushLastError: null,
      },
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

    await createAdminAlert(payload, {
      severity: 'high',
      alertType: 'data-integrity',
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
): Promise<{ jobId: string }> {
  const payload = await resolvePayload(payloadArg)

  try {
    const triggeredFields = normalizeChangedFields(changedFields)
    if (triggeredFields.length === 0) {
      throw new Error('Redwood client update was not queued because no syncable fields changed.')
    }

    const accountNumber = getRedwoodAccountNumber()
    assertRedwoodMutationAllowed(accountNumber, 'client update')
    const syncFields = REDWOOD_CLIENT_UPDATE_ALL_FIELDS

    const queued = await payload.jobs.queue({
      task: 'redwood-update-client',
      queue: 'redwood',
      input: {
        clientId,
        changedFieldsCsv: syncFields.join(','),
        requestedByAdminId: requestedByAdminId || null,
      },
      overrideAccess: true,
    })

    await payload.update({
      collection: 'clients',
      id: clientId,
      data: {
        redwoodClientUpdateStatus: 'queued',
        redwoodClientUpdateLastAttemptAt: new Date().toISOString(),
        redwoodClientUpdateLastError: null,
      },
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

    await createAdminAlert(payload, {
      severity: 'high',
      alertType: 'data-integrity',
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
): Promise<{ jobId: string }> {
  const payload = await resolvePayload(payloadArg)

  try {
    const accountNumber = getRedwoodAccountNumber()
    assertRedwoodMutationAllowed(accountNumber, 'default test sync')

    const queued = await payload.jobs.queue({
      task: 'redwood-sync-default-test',
      queue: 'redwood',
      input: {
        clientId,
      },
      overrideAccess: true,
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

    await createAdminAlert(payload, {
      severity: 'high',
      alertType: 'data-integrity',
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
