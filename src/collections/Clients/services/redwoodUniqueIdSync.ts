import type { Payload } from 'payload'

import { createAdminAlert } from '@/lib/admin-alerts'
import { assertRedwoodMutationAllowed, getRedwoodAccountNumber } from '@/lib/redwood/config'
import { buildRedwoodUniqueId } from '@/lib/redwood/unique-id'
import { backfillRedwoodClientUniqueId } from './redwoodMutationAutomation'

export async function runRedwoodUniqueIdSyncJob(
  payload: Payload,
  clientId: string,
): Promise<{
  success: boolean
  status?: 'synced' | 'manual-review' | 'failed'
  screenshotPath?: string
  error?: string
}> {
  try {
    const client = await payload.findByID({
      collection: 'clients',
      id: clientId,
      depth: 0,
      overrideAccess: true,
    })

    if (!client?.firstName?.trim() || !client?.lastName?.trim()) {
      throw new Error('Client must have first and last name before Redwood unique ID sync can run.')
    }

    const accountNumber = getRedwoodAccountNumber()
    assertRedwoodMutationAllowed(accountNumber, 'unique ID backfill')

    const uniqueId =
      typeof client.redwoodUniqueId === 'string' && client.redwoodUniqueId.trim()
        ? client.redwoodUniqueId.trim()
        : buildRedwoodUniqueId(client.id)

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

    const result = await backfillRedwoodClientUniqueId({
      payload,
      client: {
        id: client.id,
        firstName: client.firstName,
        lastName: client.lastName,
        middleInitial: client.middleInitial || undefined,
        dob: client.dob || undefined,
        redwoodUniqueId: uniqueId,
      },
      accountNumber,
    })

    await payload.update({
      collection: 'clients',
      id: client.id,
      data: {
        redwoodUniqueIdSyncStatus: result.status,
        redwoodUniqueIdLastAttemptAt: new Date().toISOString(),
        redwoodUniqueIdLastError: null,
      },
      overrideAccess: true,
    })

    return {
      success: true,
      status: result.status,
      screenshotPath: result.screenshotPath,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    payload.logger.error({
      msg: '[redwood-unique-id] Failed to sync Redwood unique ID',
      clientId,
      error: message,
    })

    await payload.update({
      collection: 'clients',
      id: clientId,
      data: {
        redwoodUniqueIdSyncStatus: 'failed',
        redwoodUniqueIdLastAttemptAt: new Date().toISOString(),
        redwoodUniqueIdLastError: message,
      },
      overrideAccess: true,
    }).catch(() => undefined)

    await createAdminAlert(payload, {
      severity: 'high',
      alertType: 'data-integrity',
      title: `Redwood unique ID sync failed for client ${clientId}`,
      message,
      context: {
        clientId,
        error: message,
      },
    })

    return {
      success: false,
      status: 'failed',
      error: message,
    }
  }
}
