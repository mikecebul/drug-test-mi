import type { Payload } from 'payload'

import { resolveClientRedwoodEligibleDefaultTest } from '@/lib/redwood/default-test'
import { assertRedwoodMutationAllowed, getRedwoodAccountNumber } from '@/lib/redwood/config'
import { classifyRedwoodIncident, upsertRedwoodIncidentAlert } from '@/lib/redwood/incidents'
import { syncClientDefaultLabTestInRedwood } from './redwoodMutationAutomation'

export async function runRedwoodDefaultTestSync(
  payload: Payload,
  clientId: string,
): Promise<{
  success: boolean
  status: 'synced' | 'skipped' | 'failed' | 'manual-review'
  screenshotPath?: string
  error?: string
  retryable?: boolean
}> {
  try {
    const client = await payload.findByID({
      collection: 'clients',
      id: clientId,
      depth: 1,
      overrideAccess: true,
    })

    const resolution = await resolveClientRedwoodEligibleDefaultTest({
      client,
      payload,
    })

    if (resolution.kind === 'skip') {
      await payload.update({
        collection: 'clients',
        id: client.id,
        data: {
          redwoodDefaultTestSyncStatus: 'skipped',
          redwoodDefaultTestLastAttemptAt: new Date().toISOString(),
          redwoodDefaultTestLastError: resolution.reason,
        },
        overrideAccess: true,
      })

      return {
        success: true,
        status: 'skipped',
      }
    }

    if (resolution.kind === 'error') {
      throw new Error(resolution.reason)
    }

    const uniqueId = typeof client.redwoodUniqueId === 'string' ? client.redwoodUniqueId.trim() : ''
    const donorId = typeof client.redwoodDonorId === 'string' ? client.redwoodDonorId.trim() : ''

    if (!uniqueId && !donorId) {
      throw new Error('Client is missing Redwood identity; default-test sync requires redwoodUniqueId or redwoodDonorId.')
    }

    const accountNumber = getRedwoodAccountNumber()
    assertRedwoodMutationAllowed(accountNumber, 'default test sync')

    await payload.update({
      collection: 'clients',
      id: client.id,
      data: {
        redwoodDefaultTestSyncStatus: 'queued',
        redwoodDefaultTestLastAttemptAt: new Date().toISOString(),
        redwoodDefaultTestLastError: null,
      },
      overrideAccess: true,
    })

    const result = await syncClientDefaultLabTestInRedwood({
      client: {
        id: String(client.id),
        firstName: client.firstName,
        lastName: client.lastName,
        middleInitial: client.middleInitial || undefined,
        dob: client.dob || undefined,
        redwoodUniqueId: uniqueId || undefined,
        redwoodDonorId: donorId || undefined,
      },
      payload,
      accountNumber,
      redwoodLabTestCode: resolution.redwoodLabTestCode,
    })

    await payload.update({
      collection: 'clients',
      id: client.id,
      data: {
        redwoodDonorId: result.donorId || donorId || null,
        redwoodDefaultTestSyncStatus: 'synced',
        redwoodDefaultTestLastAttemptAt: new Date().toISOString(),
        redwoodDefaultTestLastError: null,
      },
      overrideAccess: true,
    })

    return {
      success: true,
      status: 'synced',
      screenshotPath: result.screenshotPath,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const classification = classifyRedwoodIncident({
      message,
      jobType: 'default-test-sync',
      phase: 'runtime',
    })
    const status = classification.kind === 'manual-review-required' ? 'manual-review' : 'failed'

    payload.logger.error({
      msg: '[redwood-default-test] Failed to sync Redwood donor default test',
      clientId,
      error: message,
    })

    await payload.update({
      collection: 'clients',
      id: clientId,
      data: {
        redwoodDefaultTestSyncStatus: status,
        redwoodDefaultTestLastAttemptAt: new Date().toISOString(),
        redwoodDefaultTestLastError: message,
      },
      overrideAccess: true,
    }).catch(() => undefined)

    if (classification.kind !== 'monitor-only') {
      await upsertRedwoodIncidentAlert({
        payload,
        clientId,
        jobType: 'default-test-sync',
        kind: classification.kind,
        title:
          status === 'manual-review'
            ? `Redwood default-test sync needs manual review for client ${clientId}`
            : `Redwood default-test sync failed for client ${clientId}`,
        message,
        context: {
          clientId,
          error: message,
        },
        statusSnapshot: {
          redwoodDefaultTestSyncStatus: status,
        },
      })
    }

    return {
      success: false,
      status,
      error: message,
      retryable: classification.retryable,
    }
  }
}
