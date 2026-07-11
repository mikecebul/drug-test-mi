import type { Payload } from 'payload'

import { REDWOOD_SKIP_INACTIVATION_QUEUE_CONTEXT_KEY } from '@/lib/redwood/context'
import { assertRedwoodMutationAllowed, getRedwoodAccountNumber } from '@/lib/redwood/config'
import { classifyRedwoodIncident, upsertRedwoodIncidentAlert } from '@/lib/redwood/incidents'
import { inactivateRedwoodClientViaHttp } from './redwoodClientHttpInactivate'

export async function runRedwoodClientInactivationJob(
  payload: Payload,
  clientId: string,
): Promise<{
  error?: string
  retryable?: boolean
  status: 'failed' | 'manual-review' | 'synced'
}> {
  try {
    const client = await payload.findByID({
      collection: 'clients',
      id: clientId,
      depth: 0,
      overrideAccess: true,
    })

    if (!client?.firstName?.trim() || !client?.lastName?.trim()) {
      throw new Error('Client must have first and last name before Redwood inactivation can run.')
    }

    const uniqueId = typeof client.redwoodUniqueId === 'string' ? client.redwoodUniqueId.trim() : ''
    const donorId = typeof client.redwoodDonorId === 'string' ? client.redwoodDonorId.trim() : ''

    if (!uniqueId && !donorId) {
      throw new Error('Client is missing Redwood identity; inactivation requires redwoodUniqueId or redwoodDonorId.')
    }

    const accountNumber = getRedwoodAccountNumber()
    assertRedwoodMutationAllowed(accountNumber, 'client inactivation')

    await payload.update({
      collection: 'clients',
      id: client.id,
      data: {
        redwoodInactivationStatus: 'queued',
        redwoodInactivationLastAttemptAt: new Date().toISOString(),
        redwoodInactivationLastError: null,
      },
      context: {
        [REDWOOD_SKIP_INACTIVATION_QUEUE_CONTEXT_KEY]: true,
      },
      overrideAccess: true,
    })

    const result = await inactivateRedwoodClientViaHttp({
      accountNumber,
      client: {
        id: String(client.id),
        firstName: client.firstName,
        lastName: client.lastName,
        middleInitial: client.middleInitial || undefined,
        dob: client.dob || undefined,
        redwoodUniqueId: uniqueId || undefined,
        redwoodDonorId: donorId || undefined,
      },
    })

    await payload.update({
      collection: 'clients',
      id: client.id,
      data: {
        redwoodDonorId: result.donorId || donorId || null,
        redwoodInactivationStatus: 'synced',
        redwoodInactivationLastAttemptAt: new Date().toISOString(),
        redwoodInactivationLastError: null,
      },
      context: {
        [REDWOOD_SKIP_INACTIVATION_QUEUE_CONTEXT_KEY]: true,
      },
      overrideAccess: true,
    })

    payload.logger.info({
      msg: '[redwood-inactivation] Redwood donor inactivation completed',
      clientId: client.id,
      donorId: result.donorId,
      status: result.status,
    })

    return {
      status: 'synced',
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const classification = classifyRedwoodIncident({
      message,
      jobType: 'client-inactivation',
      phase: 'runtime',
    })
    const status = classification.kind === 'manual-review-required' ? 'manual-review' : 'failed'

    payload.logger.error({
      msg: '[redwood-inactivation] Failed to inactivate Redwood donor',
      clientId,
      err: error,
      status,
    })

    await payload.update({
      collection: 'clients',
      id: clientId,
      data: {
        redwoodInactivationStatus: status,
        redwoodInactivationLastAttemptAt: new Date().toISOString(),
        redwoodInactivationLastError: message,
      },
      context: {
        [REDWOOD_SKIP_INACTIVATION_QUEUE_CONTEXT_KEY]: true,
      },
      overrideAccess: true,
    }).catch(() => undefined)

    if (classification.kind !== 'monitor-only') {
      await upsertRedwoodIncidentAlert({
        payload,
        clientId,
        jobType: 'client-inactivation',
        kind: classification.kind,
        title:
          status === 'manual-review'
            ? `Redwood inactivation needs manual review for client ${clientId}`
            : `Redwood inactivation failed for client ${clientId}`,
        message,
        context: {
          clientId,
          error: message,
          status,
        },
        statusSnapshot: {
          redwoodInactivationStatus: status,
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
