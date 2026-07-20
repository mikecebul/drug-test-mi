import type { Payload } from 'payload'

import { mapGenderToRedwoodSex, normalizePhoneForRedwood } from '@/lib/redwood/client-fields'
import { assertRedwoodMutationAllowed, getRedwoodAccountNumber } from '@/lib/redwood/config'
import type { RedwoodMatchBy } from '@/lib/redwood/csv'
import { resolveClientRedwoodEligibleDefaultTest } from '@/lib/redwood/default-test'
import { mapReferralTypeToRedwoodGroup } from '@/lib/redwood/groups'
import { classifyRedwoodIncident, upsertRedwoodIncidentAlert } from '@/lib/redwood/incidents'
import { queueRedwoodDefaultTestSync } from '@/lib/redwood/queue'
import { buildRedwoodUniqueId } from '@/lib/redwood/unique-id'
import { createRedwoodClientViaHttp, type RedwoodHttpImportedDonor } from './redwoodClientHttpImport'

type RedwoodImportResult = {
  matchedBy?: RedwoodMatchBy
  status: 'manual-review' | 'matched-existing' | 'partial-success' | 'reactivated-existing' | 'synced'
}

async function updateClientRedwoodState(payload: Payload, clientId: string, data: Record<string, unknown>) {
  await payload.update({
    collection: 'clients',
    id: clientId,
    data,
    overrideAccess: true,
  })
}

async function hasPayloadDrugTestHistory(payload: Payload, clientId: string): Promise<boolean> {
  const result = await payload.find({
    collection: 'drug-tests',
    where: {
      relatedClient: {
        equals: clientId,
      },
    },
    depth: 0,
    limit: 1,
    overrideAccess: true,
  })

  return result.docs.length > 0
}

async function queueRequiredDefaultTest(args: {
  client: Parameters<typeof resolveClientRedwoodEligibleDefaultTest>[0]['client']
  clientId: string
  payload: Payload
  source: string
}): Promise<null | string> {
  const resolution = await resolveClientRedwoodEligibleDefaultTest({
    client: args.client,
    payload: args.payload,
  })

  if (resolution.kind === 'skip') return null
  if (resolution.kind === 'error') return resolution.reason

  try {
    await queueRedwoodDefaultTestSync(args.clientId, args.payload)
    return null
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    args.payload.logger.error({
      msg: '[redwood-import] Donor is ready, but required default-test sync could not be queued',
      clientId: args.clientId,
      source: args.source,
      error: message,
    })
    return message
  }
}

async function routeSuccessfulImport(args: {
  client: Parameters<typeof resolveClientRedwoodEligibleDefaultTest>[0]['client'] & {
    firstName: string
    lastName: string
  }
  clientId: string
  payload: Payload
  result: RedwoodHttpImportedDonor
  source: string
}): Promise<RedwoodImportResult> {
  const { client, clientId, payload, result, source } = args
  const syncStatus =
    result.status === 'imported'
      ? 'synced'
      : result.status === 'reactivated-existing'
        ? 'reactivated-existing'
        : 'matched-existing'

  await updateClientRedwoodState(payload, clientId, {
    redwoodSyncStatus: syncStatus,
    redwoodMatchedBy: result.status === 'imported' ? null : result.matchedBy || 'unique-id',
    redwoodMatchedDonorName: result.status === 'imported' ? null : result.matchedDonorName,
    redwoodCallInCode: result.callInCode,
    redwoodDonorId: result.donorId,
    redwoodLastAttemptAt: new Date().toISOString(),
    redwoodLastError: null,
  })

  payload.logger.info({
    msg: '[redwood-import] Redwood donor is active and verified via direct HTTP',
    clientId,
    source,
    donorId: result.donorId,
    callInCode: result.callInCode,
    matchedBy: result.matchedBy,
    status: syncStatus,
    queue: 'redwood',
  })

  const defaultTestError = await queueRequiredDefaultTest({ client, clientId, payload, source })
  if (!defaultTestError) {
    return {
      ...(result.matchedBy ? { matchedBy: result.matchedBy } : {}),
      status: syncStatus,
    }
  }

  const message = `Redwood donor is ready, but required default-test sync could not be queued: ${defaultTestError}`
  await updateClientRedwoodState(payload, clientId, {
    redwoodLastAttemptAt: new Date().toISOString(),
    redwoodLastError: message,
  })
  await upsertRedwoodIncidentAlert({
    payload,
    clientId,
    jobType: 'import',
    kind: 'partial-success',
    title: `Redwood donor created with a follow-up gap for client ${clientId}`,
    message,
    context: {
      clientId,
      donorId: result.donorId,
      source,
      queue: 'redwood',
    },
    statusSnapshot: {
      redwoodSyncStatus: syncStatus,
      redwoodDonorId: result.donorId,
    },
  })

  return {
    ...(result.matchedBy ? { matchedBy: result.matchedBy } : {}),
    status: 'partial-success',
  }
}

export async function runRedwoodImportClientJob(args: {
  payload: Payload
  clientId: string
  source: string
}): Promise<RedwoodImportResult> {
  const { payload, clientId, source } = args
  const accountNumber = getRedwoodAccountNumber()

  assertRedwoodMutationAllowed(accountNumber, 'import')

  const client = await payload.findByID({
    collection: 'clients',
    id: clientId,
    depth: 0,
    overrideAccess: true,
  })

  if (!client?.firstName?.trim() || !client?.lastName?.trim() || !client?.dob) {
    throw new Error('Client is missing required fields for Redwood import (firstName, lastName, dob)')
  }

  const uniqueId =
    (typeof client.redwoodUniqueId === 'string' && client.redwoodUniqueId.trim()) || buildRedwoodUniqueId(client.id)
  const donorGroup = mapReferralTypeToRedwoodGroup(client.referralType) || process.env.REDWOOD_DONOR_GROUP?.trim() || ''
  const hasDrugTestHistory = await hasPayloadDrugTestHistory(payload, String(client.id))

  try {
    const result = await createRedwoodClientViaHttp(
      {
        accountNumber,
        firstName: client.firstName,
        middleInitial: client.middleInitial || '',
        lastName: client.lastName,
        uniqueId,
        dob: client.dob,
        intakeDate: new Date(),
        sex: mapGenderToRedwoodSex(client.gender),
        phoneNumber: normalizePhoneForRedwood(client.phone || ''),
        group: donorGroup,
      },
      {
        allowCreate: !hasDrugTestHistory,
        blockedReason: hasDrugTestHistory
          ? 'Potential existing Redwood donor: Payload contains prior drug-test history, but no confident ToxAccess match was found by unique ID or name and DOB. Manual review required; automatic donor creation was blocked to prevent a duplicate.'
          : undefined,
      },
    )

    return await routeSuccessfulImport({
      client,
      clientId: String(client.id),
      payload,
      result,
      source,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const classification = classifyRedwoodIncident({
      message,
      jobType: 'import',
      phase: 'runtime',
    })
    const attemptedAt = new Date().toISOString()

    payload.logger.error({
      msg: '[redwood-import] Direct HTTP donor provisioning failed',
      clientId,
      source,
      error: message,
      retryable: classification.retryable,
      hasDrugTestHistory,
      queue: 'redwood',
    })

    if (classification.retryable) {
      await updateClientRedwoodState(payload, String(client.id), {
        redwoodSyncStatus: 'queued',
        redwoodLastAttemptAt: attemptedAt,
        redwoodLastError: message,
      })
      throw error
    }

    await updateClientRedwoodState(payload, String(client.id), {
      redwoodSyncStatus: 'manual-review',
      redwoodLastAttemptAt: attemptedAt,
      redwoodLastError: message,
    })
    await upsertRedwoodIncidentAlert({
      payload,
      clientId: String(client.id),
      jobType: 'import',
      kind: classification.kind === 'manual-review-required' ? 'manual-review-required' : 'business-critical-failure',
      title: `Redwood donor provisioning needs attention for client ${client.id}`,
      message,
      context: {
        clientId: client.id,
        source,
        hasDrugTestHistory,
        queue: 'redwood',
      },
      statusSnapshot: {
        redwoodSyncStatus: 'manual-review',
      },
    })

    return { status: 'manual-review' }
  }
}
