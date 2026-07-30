const REQUIRED_RANDOM_TESTING_SYNC_ENVS = [
  'CAL_API_KEY',
  'GOOGLE_CALENDAR_ID',
  'GOOGLE_CALENDAR_SERVICE_ACCOUNT_EMAIL',
  'REDWOOD_PASSWORD',
  'REDWOOD_USERNAME',
] as const

const GOOGLE_CALENDAR_PRIVATE_KEY_ENV =
  'GOOGLE_CALENDAR_SERVICE_ACCOUNT_PRIVATE_KEY or GOOGLE_CALENDAR_SERVICE_ACCOUNT_PRIVATE_KEY_BASE64'

export type RandomTestingSyncRuntimeState = {
  configured: boolean
  enabled: boolean
  missing: string[]
}

export function getRandomTestingSyncRuntimeState(): RandomTestingSyncRuntimeState {
  const missing: string[] = REQUIRED_RANDOM_TESTING_SYNC_ENVS.filter(
    (name) => !process.env[name]?.trim(),
  )
  const hasGoogleCalendarPrivateKey = Boolean(
    process.env.GOOGLE_CALENDAR_SERVICE_ACCOUNT_PRIVATE_KEY?.trim() ||
      process.env.GOOGLE_CALENDAR_SERVICE_ACCOUNT_PRIVATE_KEY_BASE64?.trim(),
  )

  if (!hasGoogleCalendarPrivateKey) missing.push(GOOGLE_CALENDAR_PRIVATE_KEY_ENV)

  return {
    configured: missing.length === 0,
    enabled: process.env.RANDOM_TESTING_SCHEDULE_SYNC_ENABLED?.trim().toLowerCase() === 'true',
    missing,
  }
}
