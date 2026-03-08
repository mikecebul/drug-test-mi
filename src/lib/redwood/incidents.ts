import type { Payload } from 'payload'

export type RedwoodJobType =
  | 'import'
  | 'client-update'
  | 'headshot-sync'
  | 'headshot-upload'
  | 'unique-id-sync'
  | 'default-test-sync'

export type RedwoodIncidentKind =
  | 'business-critical-failure'
  | 'manual-review-required'
  | 'partial-success'
  | 'monitor-only'

export type RedwoodIncidentClassification = {
  errorClass: string
  kind: RedwoodIncidentKind
  retryable: boolean
}

export type RedwoodIncidentRecordParams = {
  payload: Payload
  clientId: string
  jobType: RedwoodJobType
  title: string
  message: string
  kind: Exclude<RedwoodIncidentKind, 'monitor-only'>
  context?: Record<string, unknown>
  screenshotPath?: string | null
  statusSnapshot?: Record<string, unknown>
}

function normalizeMessage(message: string): string {
  return message.trim().toLowerCase()
}

function deriveRedwoodErrorClass(message: string): string {
  const normalized = normalizeMessage(message)

  if (normalized.includes('redwood import rejected') || normalized.includes('rejected row')) {
    return 'import-rejected'
  }

  if (normalized.includes('manual review required') || normalized.includes('ambiguous')) {
    return 'manual-review-match'
  }

  if (normalized.includes('metadata lookup failed') || normalized.includes('missing redwood identity after import')) {
    return 'post-import-identity-gap'
  }

  if (normalized.includes('default-test') && normalized.includes('queue')) {
    return 'default-test-follow-up-queue-failed'
  }

  if (normalized.includes('login failed') || normalized.includes('missing required environment variable')) {
    return 'runtime-auth'
  }

  if (
    normalized.includes('unable to find redwood') ||
    normalized.includes('did not complete successfully') ||
    normalized.includes('could not be verified') ||
    normalized.includes('did not reach submit-ready state') ||
    normalized.includes('submit action did not complete')
  ) {
    return 'mutation-verification-failed'
  }

  if (normalized.includes('missing a website headshot') || normalized.includes('client id is required')) {
    return 'invalid-input'
  }

  if (normalized.includes('no redwood donor rows found') || normalized.includes('no dob-verified redwood donor match found')) {
    return 'donor-not-found'
  }

  return 'unknown'
}

export function classifyRedwoodIncident(args: {
  message: string
  jobType: RedwoodJobType
  phase?:
    | 'queue'
    | 'runtime'
    | 'manual-review'
    | 'partial-success'
    | 'follow-up'
}): RedwoodIncidentClassification {
  const { message, phase } = args
  const errorClass = deriveRedwoodErrorClass(message)
  const normalized = normalizeMessage(message)

  if (phase === 'manual-review') {
    return {
      errorClass,
      kind: 'manual-review-required',
      retryable: false,
    }
  }

  if (phase === 'partial-success') {
    return {
      errorClass,
      kind: 'partial-success',
      retryable: false,
    }
  }

  if (phase === 'queue') {
    return {
      errorClass,
      kind: 'business-critical-failure',
      retryable: false,
    }
  }

  if (phase === 'follow-up' && normalized.includes('default-test')) {
    return {
      errorClass,
      kind: 'partial-success',
      retryable: false,
    }
  }

  if (
    normalized.includes('potential existing redwood donor') ||
    normalized.includes('manual review required') ||
    normalized.includes('rejected row') ||
    normalized.includes('rejected one or more import rows')
  ) {
    return {
      errorClass,
      kind: normalized.includes('rejected row') ? 'business-critical-failure' : 'manual-review-required',
      retryable: false,
    }
  }

  if (
    errorClass === 'donor-not-found' ||
    normalized.includes('no confident name-only redwood donor match found') ||
    normalized.includes('unable to resolve redwood donor id')
  ) {
    return {
      errorClass,
      kind: 'manual-review-required',
      retryable: false,
    }
  }

  if (errorClass === 'invalid-input') {
    return {
      errorClass,
      kind: 'monitor-only',
      retryable: false,
    }
  }

  if (
    errorClass === 'mutation-verification-failed' ||
    errorClass === 'post-import-identity-gap'
  ) {
    return {
      errorClass,
      kind: 'business-critical-failure',
      retryable: false,
    }
  }

  return {
    errorClass,
    kind: 'monitor-only',
    retryable: true,
  }
}

function buildRedwoodDedupeKey(args: {
  clientId: string
  errorClass: string
  jobType: RedwoodJobType
  kind: Exclude<RedwoodIncidentKind, 'monitor-only'>
}): string {
  const { clientId, errorClass, jobType, kind } = args
  return ['redwood', jobType, clientId, kind, errorClass].join(':')
}

function getRecommendedAction(args: {
  errorClass: string
  kind: Exclude<RedwoodIncidentKind, 'monitor-only'>
  jobType: RedwoodJobType
}): string {
  const { errorClass, kind, jobType } = args

  if (kind === 'manual-review-required') {
    return 'Review the Redwood donor match and decide whether to link the existing donor or proceed manually.'
  }

  if (errorClass === 'post-import-identity-gap') {
    return 'Open the client Redwood Sync panel, verify donor identity fields, and rerun the blocked follow-up syncs.'
  }

  if (errorClass === 'mutation-verification-failed') {
    return 'Verify Redwood page controls/selectors, inspect the screenshot, and rerun the affected Redwood workflow.'
  }

  if (jobType === 'default-test-sync') {
    return 'Verify the client default test mapping and rerun Redwood default-test sync if it is required for this client.'
  }

  return 'Review the client Redwood Sync panel, inspect the latest screenshot, and rerun the blocked Redwood workflow after correcting the issue.'
}

export async function upsertRedwoodIncidentAlert(params: RedwoodIncidentRecordParams): Promise<void> {
  const { clientId, context, jobType, kind, message, payload, screenshotPath, statusSnapshot, title } = params
  const classification = classifyRedwoodIncident({
    message,
    jobType,
    phase: kind === 'manual-review-required' ? 'manual-review' : kind === 'partial-success' ? 'partial-success' : 'runtime',
  })
  const dedupeKey = buildRedwoodDedupeKey({
    clientId,
    errorClass: classification.errorClass,
    jobType,
    kind,
  })
  const now = new Date().toISOString()
  const recommendedAction = getRecommendedAction({
    errorClass: classification.errorClass,
    kind,
    jobType,
  })

  try {
    const existing = await payload.find({
      collection: 'admin-alerts',
      where: {
        dedupeKey: {
          equals: dedupeKey,
        },
      },
      limit: 1,
      sort: '-updatedAt',
      overrideAccess: true,
    })

    const sharedData = {
      title,
      severity: 'high' as const,
      alertType: 'data-integrity' as const,
      message,
      context: {
        ...(context || {}),
        errorClass: classification.errorClass,
        kind,
        recommendedAction,
      },
      client: clientId,
      jobType,
      dedupeKey,
      statusSnapshot: statusSnapshot || null,
      screenshotPath: screenshotPath || null,
      lastSeenAt: now,
      recommendedAction,
      resolved: false,
    }

    const existingDoc = existing.docs[0]
    if (existingDoc) {
      const priorAttempts =
        typeof existingDoc.attemptCount === 'number' && Number.isFinite(existingDoc.attemptCount)
          ? existingDoc.attemptCount
          : 1

      await payload.update({
        collection: 'admin-alerts',
        id: existingDoc.id,
        data: {
          ...sharedData,
          attemptCount: priorAttempts + 1,
        },
        overrideAccess: true,
      })

      return
    }

    await payload.create({
      collection: 'admin-alerts',
      data: {
        ...sharedData,
        attemptCount: 1,
      },
      overrideAccess: true,
    })
  } catch (error) {
    payload.logger.error({
      msg: '[redwood-alerts] Failed to upsert Redwood admin alert',
      clientId,
      dedupeKey,
      error: error instanceof Error ? error.message : String(error),
      jobType,
      kind,
      originalMessage: message,
    })
  }
}
