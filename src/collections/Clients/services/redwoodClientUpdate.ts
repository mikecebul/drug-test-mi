import type { Payload } from 'payload'

import { REDWOOD_SKIP_CLIENT_UPDATE_QUEUE_CONTEXT_KEY } from '@/lib/redwood/context'
import { assertRedwoodMutationAllowed, getRedwoodAccountNumber } from '@/lib/redwood/config'
import { classifyRedwoodIncident, upsertRedwoodIncidentAlert } from '@/lib/redwood/incidents'
import type { RedwoodClientUpdateField } from '@/lib/redwood/queue'
import {
  REDWOOD_PENDING_CLIENT_UPDATE_FIELDS,
  removePendingRedwoodClientUpdateFields,
} from '../redwoodSyncFields'
import { updateRedwoodClientDetailsViaHttp } from './redwoodClientHttpUpdate'

function shouldRouteClientUpdateToManualReview(message: string): boolean {
  return (
    /no redwood donor rows found/i.test(message) ||
    /no dob-verified redwood donor match found/i.test(message) ||
    /no confident name-only redwood donor match found/i.test(message) ||
    /ambiguous/i.test(message) ||
    /not in REDWOOD_ALLOWED_ACCOUNT_NUMBERS/i.test(message) ||
    /did not expose its account number/i.test(message)
  )
}

export async function runRedwoodClientUpdateJob(
  payload: Payload,
  clientId: string,
  changedFields: RedwoodClientUpdateField[],
): Promise<{
  error?: string
  retryable?: boolean
  status: 'failed' | 'manual-review' | 'synced'
  updatedFields?: RedwoodClientUpdateField[]
}> {
  const normalizedFields = Array.from(new Set(changedFields.map((field) => field.trim()).filter(Boolean))) as RedwoodClientUpdateField[]

  try {
    if (normalizedFields.length === 0) {
      throw new Error('Client update job requires at least one syncable field.')
    }

    const client = await payload.findByID({
      collection: 'clients',
      id: clientId,
      depth: 0,
      overrideAccess: true,
    })

    if (!client?.firstName?.trim() || !client?.lastName?.trim()) {
      throw new Error('Client must have first and last name before Redwood update can run.')
    }

    const accountNumber =
      (typeof client.redwoodAccountNumber === 'string' && client.redwoodAccountNumber.trim()) ||
      getRedwoodAccountNumber()
    assertRedwoodMutationAllowed(accountNumber, 'client update')

    await payload.update({
      collection: 'clients',
      id: client.id,
      data: {
        redwoodClientUpdateStatus: 'queued',
        redwoodClientUpdateLastAttemptAt: new Date().toISOString(),
        redwoodClientUpdateLastError: null,
      },
      context: {
        [REDWOOD_SKIP_CLIENT_UPDATE_QUEUE_CONTEXT_KEY]: true,
      },
      overrideAccess: true,
    })

    const result = await updateRedwoodClientDetailsViaHttp({
      client: {
        id: String(client.id),
        firstName: client.firstName,
        lastName: client.lastName,
        middleInitial: client.middleInitial || undefined,
        dob: client.dob || undefined,
        redwoodAccountNumber: accountNumber,
        redwoodDonorId: typeof client.redwoodDonorId === 'string' ? client.redwoodDonorId : undefined,
        gender: client.gender || undefined,
        phone: client.phone || undefined,
      },
      accountNumber,
      changedFields: normalizedFields,
    })

    await payload.update({
      collection: 'clients',
      id: client.id,
      data: {
        redwoodAccountNumber: result.accountNumber,
        redwoodCallInCode: result.callInCode || (typeof client.redwoodCallInCode === 'string' ? client.redwoodCallInCode : null),
        redwoodClientUpdateStatus: 'synced',
        redwoodClientUpdateLastAttemptAt: new Date().toISOString(),
        redwoodClientUpdateLastError: null,
        redwoodDonorId: result.donorId || (typeof client.redwoodDonorId === 'string' ? client.redwoodDonorId : null),
        [REDWOOD_PENDING_CLIENT_UPDATE_FIELDS]: removePendingRedwoodClientUpdateFields(
          client[REDWOOD_PENDING_CLIENT_UPDATE_FIELDS],
          result.updatedFields && result.updatedFields.length > 0 ? result.updatedFields : normalizedFields,
        ),
      },
      context: {
        [REDWOOD_SKIP_CLIENT_UPDATE_QUEUE_CONTEXT_KEY]: true,
      },
      overrideAccess: true,
    })

    return {
      status: 'synced',
      updatedFields: result.updatedFields,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const status = shouldRouteClientUpdateToManualReview(message) ? 'manual-review' : 'failed'
    const classification = classifyRedwoodIncident({
      message,
      jobType: 'client-update',
      phase: status === 'manual-review' ? 'manual-review' : 'runtime',
    })

    payload.logger.error({
      msg: '[redwood-client-update] Failed to update Redwood donor',
      clientId,
      changedFields: normalizedFields,
      error: message,
      status,
    })

    await payload.update({
      collection: 'clients',
      id: clientId,
      data: {
        redwoodClientUpdateStatus: status,
        redwoodClientUpdateLastAttemptAt: new Date().toISOString(),
        redwoodClientUpdateLastError: message,
      },
      context: {
        [REDWOOD_SKIP_CLIENT_UPDATE_QUEUE_CONTEXT_KEY]: true,
      },
      overrideAccess: true,
    }).catch(() => undefined)

    if (classification.kind !== 'monitor-only') {
      await upsertRedwoodIncidentAlert({
        payload,
        clientId,
        jobType: 'client-update',
        kind: classification.kind,
        title:
          status === 'manual-review'
            ? `Redwood client update needs manual review for client ${clientId}`
            : `Redwood client update failed for client ${clientId}`,
        message,
        context: {
          changedFields: normalizedFields,
          clientId,
          error: message,
          status,
        },
        statusSnapshot: {
          redwoodClientUpdateStatus: status,
        },
      })
    }

    return {
      error: message,
      retryable: classification.retryable,
      status,
    }
  }
}
