import type { Client } from '@/payload-types'

const GUIDED_RETRYABLE_DONOR_STATUSES = new Set<Client['redwoodSyncStatus']>([
  'not-queued',
  'failed',
  'manual-review',
])

const GUIDED_READY_DONOR_STATUSES = new Set<Client['redwoodSyncStatus']>([
  'matched-existing',
  'reactivated-existing',
  'synced',
])

export function hasReadyGuidedRedwoodDonor(args: {
  donorId: Client['redwoodDonorId']
  syncStatus: Client['redwoodSyncStatus']
}): boolean {
  return Boolean(
    typeof args.donorId === 'string' &&
      args.donorId.trim() &&
      args.syncStatus &&
      GUIDED_READY_DONOR_STATUSES.has(args.syncStatus),
  )
}

export function shouldTreatGuidedRedwoodImportAsFailed(args: {
  donorId: Client['redwoodDonorId']
  importRetriesExhausted: boolean
  syncStatus: Client['redwoodSyncStatus']
}): boolean {
  return (
    args.importRetriesExhausted &&
    !hasReadyGuidedRedwoodDonor({
      donorId: args.donorId,
      syncStatus: args.syncStatus,
    })
  )
}

export function shouldQueueGuidedRedwoodDonor(args: {
  retryFailedDonor: boolean
  syncStatus: Client['redwoodSyncStatus']
}): boolean {
  if (args.retryFailedDonor) return true
  if (!args.syncStatus) return true

  return GUIDED_RETRYABLE_DONOR_STATUSES.has(args.syncStatus)
}
