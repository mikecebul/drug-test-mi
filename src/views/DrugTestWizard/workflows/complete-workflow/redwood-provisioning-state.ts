import type { Client } from '@/payload-types'

const GUIDED_RETRYABLE_DONOR_STATUSES = new Set<Client['redwoodSyncStatus']>([
  'not-queued',
  'failed',
  'manual-review',
])

export function shouldQueueGuidedRedwoodDonor(args: {
  retryFailedDonor: boolean
  syncStatus: Client['redwoodSyncStatus']
}): boolean {
  if (args.retryFailedDonor) return true
  if (!args.syncStatus) return true

  return GUIDED_RETRYABLE_DONOR_STATUSES.has(args.syncStatus)
}
