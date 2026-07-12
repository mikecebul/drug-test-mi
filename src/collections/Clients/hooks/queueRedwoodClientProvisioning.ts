import type { CollectionAfterChangeHook } from 'payload'

import {
  REDWOOD_PROVISIONING_SOURCE_CONTEXT_KEY,
  REDWOOD_SKIP_PROVISIONING_QUEUE_CONTEXT_KEY,
} from '@/lib/redwood/context'
import {
  getAllowedRedwoodAccountNumbers,
  getRedwoodAccountNumber,
  getRedwoodAutomationRuntimeState,
} from '@/lib/redwood/config'
import {
  queueRedwoodImportForClient,
  type RedwoodQueueSource,
} from '@/lib/redwood/queue'

const VALID_SOURCES = new Set<RedwoodQueueSource>([
  'admin-registration',
  'client-reactivation',
  'frontend-registration',
  'manual',
  'wizard-registration',
])

function getQueueSource(value: unknown, isAdmin: boolean): RedwoodQueueSource {
  if (typeof value === 'string' && VALID_SOURCES.has(value as RedwoodQueueSource)) {
    return value as RedwoodQueueSource
  }

  return isAdmin ? 'admin-registration' : 'frontend-registration'
}

function isInactive(value: unknown): boolean {
  return value === false || value === 'false'
}

export const queueRedwoodClientProvisioningAfterChange: CollectionAfterChangeHook = async ({
  doc,
  operation,
  previousDoc,
  req,
}) => {
  const isCreate = operation === 'create'
  const isReactivation =
    operation === 'update' && !isInactive(doc?.isActive) && isInactive(previousDoc?.isActive)
  const isClientInactive = isInactive(doc?.isActive)
  const contextSkipRequested = Boolean(req.context?.[REDWOOD_SKIP_PROVISIONING_QUEUE_CONTEXT_KEY])

  if (!isCreate && !isReactivation) {
    return doc
  }

  const source = isReactivation
    ? 'client-reactivation'
    : getQueueSource(
        req.context?.[REDWOOD_PROVISIONING_SOURCE_CONTEXT_KEY],
        req.user?.collection === 'admins',
      )
  const runtimeState = getRedwoodAutomationRuntimeState()
  const diagnostics = {
    clientId: String(doc.id),
    operation,
    source,
    isCreate,
    isReactivation,
    isClientInactive,
    contextSkipRequested,
    automationConfigured: runtimeState.configured,
    automationConfiguredValue: runtimeState.configuredValue,
    automationEnabled: runtimeState.enabled,
    nodeEnv: runtimeState.nodeEnv,
    redwoodAccountNumber: getRedwoodAccountNumber(),
    redwoodAllowedAccountNumbers: getAllowedRedwoodAccountNumbers(),
  }

  if (isClientInactive) {
    req.payload.logger.info({
      msg: '[clients] Skipped Redwood donor provisioning for an inactive client',
      ...diagnostics,
      skipReason: 'inactive-client',
    })
    return doc
  }

  if (contextSkipRequested) {
    req.payload.logger.info({
      msg: '[clients] Skipped Redwood donor provisioning because request context disabled it',
      ...diagnostics,
      skipReason: 'request-context',
    })
    return doc
  }

  if (!runtimeState.enabled) {
    req.payload.logger.warn({
      msg: '[clients] Skipped Redwood donor provisioning because automation is disabled',
      ...diagnostics,
      skipReason: 'automation-disabled',
    })
    return doc
  }

  req.payload.logger.info({
    msg: '[clients] Attempting to queue Redwood donor provisioning',
    ...diagnostics,
  })

  try {
    await queueRedwoodImportForClient(String(doc.id), source, req.payload, req)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    req.payload.logger.error({
      msg: '[clients] Failed to queue Redwood donor provisioning after client save',
      clientId: String(doc.id),
      source,
      err: error,
    })

    await req.payload
      .update({
        collection: 'clients',
        id: String(doc.id),
        data: {
          redwoodSyncStatus: 'failed',
          redwoodLastAttemptAt: new Date().toISOString(),
          redwoodLastError: message,
        },
        context: {
          ...req.context,
          [REDWOOD_SKIP_PROVISIONING_QUEUE_CONTEXT_KEY]: true,
        },
        req,
        overrideAccess: true,
      })
      .catch(() => undefined)
  }

  return doc
}
