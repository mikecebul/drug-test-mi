export type RedwoodProvisioningStepStatus =
  | 'complete'
  | 'failed'
  | 'manual-review'
  | 'running'
  | 'skipped'
  | 'waiting'

export type RedwoodProvisioningStep = {
  id: 'donor' | 'default-test' | 'headshot'
  label: string
  message: string
  status: RedwoodProvisioningStepStatus
}

export type RedwoodProvisioningStatus = {
  automationEnabled: boolean
  callInCode: string | null
  canContinue: boolean
  donorId: string | null
  lastError: string | null
  overallStatus: 'disabled' | 'failed' | 'manual-review' | 'ready' | 'ready-with-warnings' | 'working'
  steps: RedwoodProvisioningStep[]
}

const DONOR_READY_STATUSES = new Set(['matched-existing', 'reactivated-existing', 'synced'])
const IN_PROGRESS_STATUSES = new Set(['queued'])

function mapFollowUpStep(args: {
  completeMessage: string
  failedMessage: string
  id: 'default-test' | 'headshot'
  label: string
  required: boolean
  skippedMessage: string
  status: unknown
  waitingMessage: string
}): RedwoodProvisioningStep {
  if (!args.required || args.status === 'skipped') {
    return {
      id: args.id,
      label: args.label,
      message: args.skippedMessage,
      status: 'skipped',
    }
  }

  if (args.status === 'synced') {
    return {
      id: args.id,
      label: args.label,
      message: args.completeMessage,
      status: 'complete',
    }
  }

  if (args.status === 'manual-review') {
    return {
      id: args.id,
      label: args.label,
      message: args.failedMessage,
      status: 'manual-review',
    }
  }

  if (args.status === 'failed') {
    return {
      id: args.id,
      label: args.label,
      message: args.failedMessage,
      status: 'failed',
    }
  }

  return {
    id: args.id,
    label: args.label,
    message: args.status === 'queued' ? 'Queued and waiting for the Redwood worker.' : args.waitingMessage,
    status: args.status === 'queued' ? 'running' : 'waiting',
  }
}

export function deriveRedwoodProvisioningStatus(input: {
  automationEnabled: boolean
  callInCode?: unknown
  defaultTestRequired: boolean
  defaultTestStatus?: unknown
  donorId?: unknown
  headshotRequired: boolean
  headshotStatus?: unknown
  lastError?: unknown
  syncStatus?: unknown
}): RedwoodProvisioningStatus {
  const syncStatus = typeof input.syncStatus === 'string' ? input.syncStatus : 'not-queued'
  const donorId = typeof input.donorId === 'string' && input.donorId.trim() ? input.donorId.trim() : null
  const callInCode =
    typeof input.callInCode === 'string' && input.callInCode.trim() ? input.callInCode.trim() : null
  const lastError =
    typeof input.lastError === 'string' && input.lastError.trim() ? input.lastError.trim() : null
  const donorReady = DONOR_READY_STATUSES.has(syncStatus) && Boolean(donorId)

  let donorStep: RedwoodProvisioningStep
  if (donorReady) {
    donorStep = {
      id: 'donor',
      label: 'Donor record',
      message: syncStatus === 'matched-existing' ? 'Matched the existing active donor.' : 'Donor is active and verified.',
      status: 'complete',
    }
  } else if (syncStatus === 'manual-review' || (DONOR_READY_STATUSES.has(syncStatus) && !donorId)) {
    donorStep = {
      id: 'donor',
      label: 'Donor record',
      message: lastError || 'Donor identity needs manual review before collection can continue.',
      status: 'manual-review',
    }
  } else if (syncStatus === 'failed') {
    donorStep = {
      id: 'donor',
      label: 'Donor record',
      message: lastError || 'Donor creation failed after retrying.',
      status: 'failed',
    }
  } else {
    donorStep = {
      id: 'donor',
      label: 'Donor record',
      message: IN_PROGRESS_STATUSES.has(syncStatus)
        ? 'Checking for an existing donor and creating one if needed.'
        : 'Waiting to queue donor creation.',
      status: IN_PROGRESS_STATUSES.has(syncStatus) ? 'running' : 'waiting',
    }
  }

  const defaultTestStep = mapFollowUpStep({
    id: 'default-test',
    label: 'Default lab test',
    required: input.defaultTestRequired,
    status: input.defaultTestStatus,
    completeMessage: 'Default lab test is set in ToxAccess.',
    failedMessage: 'Default lab test could not be verified automatically.',
    skippedMessage: 'No Redwood lab default is required for this client.',
    waitingMessage: donorReady ? 'Waiting to set the default lab test.' : 'Starts after the donor is verified.',
  })

  const headshotStep = mapFollowUpStep({
    id: 'headshot',
    label: 'Headshot',
    required: input.headshotRequired,
    status: input.headshotStatus,
    completeMessage: 'Client headshot is uploaded to ToxAccess.',
    failedMessage: 'Headshot upload needs attention, but donor collection can continue.',
    skippedMessage: 'No website headshot is available yet; it will sync after capture.',
    waitingMessage: donorReady ? 'Waiting to upload the client headshot.' : 'Starts after the donor is verified.',
  })

  const steps = [donorStep, defaultTestStep, headshotStep]

  if (!input.automationEnabled) {
    return {
      automationEnabled: false,
      callInCode,
      canContinue: false,
      donorId,
      lastError: 'Redwood automation is disabled on this server.',
      overallStatus: 'disabled',
      steps,
    }
  }

  if (donorStep.status === 'manual-review') {
    return {
      automationEnabled: true,
      callInCode,
      canContinue: false,
      donorId,
      lastError,
      overallStatus: 'manual-review',
      steps,
    }
  }

  if (donorStep.status === 'failed') {
    return {
      automationEnabled: true,
      callInCode,
      canContinue: false,
      donorId,
      lastError,
      overallStatus: 'failed',
      steps,
    }
  }

  const blockingStepsComplete =
    donorStep.status === 'complete' &&
    (defaultTestStep.status === 'complete' || defaultTestStep.status === 'skipped')

  const defaultTestNeedsManualHelp =
    donorStep.status === 'complete' &&
    (defaultTestStep.status === 'failed' || defaultTestStep.status === 'manual-review')

  if (defaultTestNeedsManualHelp) {
    return {
      automationEnabled: true,
      callInCode,
      canContinue: true,
      donorId,
      lastError,
      overallStatus: 'ready-with-warnings',
      steps,
    }
  }

  if (blockingStepsComplete) {
    const hasHeadshotWarning = headshotStep.status === 'failed' || headshotStep.status === 'manual-review'
    const headshotStillWorking = headshotStep.status === 'running' || headshotStep.status === 'waiting'

    return {
      automationEnabled: true,
      callInCode,
      canContinue: true,
      donorId,
      lastError,
      overallStatus: hasHeadshotWarning || headshotStillWorking ? 'ready-with-warnings' : 'ready',
      steps,
    }
  }

  return {
    automationEnabled: true,
    callInCode,
    canContinue: false,
    donorId,
    lastError,
    overallStatus: 'working',
    steps,
  }
}
