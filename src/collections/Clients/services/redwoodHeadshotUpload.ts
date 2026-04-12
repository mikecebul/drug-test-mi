import type { Payload } from 'payload'

import { assertRedwoodMutationAllowed, getRedwoodAccountNumber } from '@/lib/redwood/config'
import { classifyRedwoodIncident, upsertRedwoodIncidentAlert } from '@/lib/redwood/incidents'
import { uploadClientHeadshotToRedwood } from './redwoodMutationAutomation'

export async function runRedwoodHeadshotUploadJob(
  payload: Payload,
  clientId: string,
): Promise<{
  success: boolean
  status?: 'synced' | 'manual-review' | 'failed'
  screenshotPath?: string
  error?: string
  retryable?: boolean
}> {
  try {
    const client = await payload.findByID({
      collection: 'clients',
      id: clientId,
      depth: 0,
      overrideAccess: true,
    })

    if (!client?.firstName?.trim() || !client?.lastName?.trim()) {
      throw new Error('Client must have first and last name before Redwood headshot upload can run.')
    }

    const uniqueId = typeof client.redwoodUniqueId === 'string' ? client.redwoodUniqueId.trim() : ''
    const donorId = typeof client.redwoodDonorId === 'string' ? client.redwoodDonorId.trim() : ''
    const headshotId =
      typeof client.headshot === 'string'
        ? client.headshot
        : client.headshot && typeof client.headshot === 'object' && 'id' in client.headshot
          ? String(client.headshot.id)
          : ''

    if (!uniqueId && !donorId) {
      throw new Error('Client is missing Redwood identity; headshot upload requires redwoodUniqueId or redwoodDonorId.')
    }

    if (!headshotId) {
      throw new Error('Client is missing a website headshot; Redwood headshot upload cannot run.')
    }

    const accountNumber = getRedwoodAccountNumber()
    assertRedwoodMutationAllowed(accountNumber, 'headshot upload')

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

    const result = await uploadClientHeadshotToRedwood({
      client: {
        id: client.id,
        firstName: client.firstName,
        lastName: client.lastName,
        redwoodUniqueId: uniqueId || undefined,
        redwoodDonorId: donorId || undefined,
        headshotId,
      },
      payload,
      accountNumber,
    })

    await payload.update({
      collection: 'clients',
      id: client.id,
      data: {
        redwoodDonorId: result.donorId || (typeof client.redwoodDonorId === 'string' ? client.redwoodDonorId : null),
        redwoodCallInCode: result.callInCode || (typeof client.redwoodCallInCode === 'string' ? client.redwoodCallInCode : null),
        redwoodHeadshotPushStatus: result.status,
        redwoodHeadshotPushLastAttemptAt: new Date().toISOString(),
        redwoodHeadshotPushLastError: null,
      },
      overrideAccess: true,
    })

    payload.logger.info({
      msg: '[redwood-headshot-upload] Redwood headshot upload completed',
      clientId: client.id,
      donorId: result.donorId || (typeof client.redwoodDonorId === 'string' ? client.redwoodDonorId : null),
      callInCode: result.callInCode || (typeof client.redwoodCallInCode === 'string' ? client.redwoodCallInCode : null),
      screenshotPath: result.screenshotPath,
      status: result.status,
    })

    return {
      success: true,
      status: result.status,
      screenshotPath: result.screenshotPath,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const classification = classifyRedwoodIncident({
      message,
      jobType: 'headshot-upload',
      phase: 'runtime',
    })
    const status = classification.kind === 'manual-review-required' ? 'manual-review' : 'failed'

    payload.logger.error({
      msg: '[redwood-headshot-upload] Failed to upload Redwood headshot',
      clientId,
      error: message,
    })

    await payload.update({
      collection: 'clients',
      id: clientId,
      data: {
        redwoodHeadshotPushStatus: status,
        redwoodHeadshotPushLastAttemptAt: new Date().toISOString(),
        redwoodHeadshotPushLastError: message,
      },
      overrideAccess: true,
    }).catch(() => undefined)

    if (classification.kind !== 'monitor-only') {
      await upsertRedwoodIncidentAlert({
        payload,
        clientId,
        jobType: 'headshot-upload',
        kind: classification.kind,
        title:
          status === 'manual-review'
            ? `Redwood headshot upload needs manual review for client ${clientId}`
            : `Redwood headshot upload failed for client ${clientId}`,
        message,
        context: {
          clientId,
          error: message,
        },
        statusSnapshot: {
          redwoodHeadshotPushStatus: status,
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
