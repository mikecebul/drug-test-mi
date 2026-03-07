import type { Payload } from 'payload'

import { createAdminAlert } from '@/lib/admin-alerts'
import { assertRedwoodMutationAllowed, getRedwoodAccountNumber } from '@/lib/redwood/config'
import { uploadClientHeadshotToRedwood } from './redwoodMutationAutomation'

export async function runRedwoodHeadshotUploadJob(
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

    return {
      success: true,
      status: result.status,
      screenshotPath: result.screenshotPath,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    payload.logger.error({
      msg: '[redwood-headshot-upload] Failed to upload Redwood headshot',
      clientId,
      error: message,
    })

    await payload.update({
      collection: 'clients',
      id: clientId,
      data: {
        redwoodHeadshotPushStatus: 'failed',
        redwoodHeadshotPushLastAttemptAt: new Date().toISOString(),
        redwoodHeadshotPushLastError: message,
      },
      overrideAccess: true,
    }).catch(() => undefined)

    await createAdminAlert(payload, {
      severity: 'high',
      alertType: 'data-integrity',
      title: `Redwood headshot upload failed for client ${clientId}`,
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
