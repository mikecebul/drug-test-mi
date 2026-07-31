export const RETRYABLE_JOB_TASK_SLUGS = [
  'redwood-import-client',
  'redwood-update-client',
  'redwood-inactivate-client',
  'redwood-queue-pending-client-updates-nightly',
  'redwood-upload-headshot',
  'redwood-sync-default-test',
  'redwood-sync-upcoming-random-testing',
  'redwood-sync-todays-random-testing',
] as const

export type RetryableJobTaskSlug = (typeof RETRYABLE_JOB_TASK_SLUGS)[number]

export function isRetryableJobTaskSlug(taskSlug: unknown): taskSlug is RetryableJobTaskSlug {
  return typeof taskSlug === 'string' && RETRYABLE_JOB_TASK_SLUGS.includes(taskSlug as RetryableJobTaskSlug)
}
