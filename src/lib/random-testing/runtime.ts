const REQUIRED_RANDOM_TESTING_SYNC_ENVS = [
  'CAL_API_KEY',
  'GOOGLE_CALENDAR_ID',
  'GOOGLE_CALENDAR_SERVICE_ACCOUNT_EMAIL',
  'GOOGLE_CALENDAR_SERVICE_ACCOUNT_PRIVATE_KEY',
  'REDWOOD_PASSWORD',
  'REDWOOD_USERNAME',
] as const

export type RandomTestingSyncRuntimeState = {
  configured: boolean
  enabled: boolean
  missing: string[]
}

export function getRandomTestingSyncRuntimeState(): RandomTestingSyncRuntimeState {
  const missing = REQUIRED_RANDOM_TESTING_SYNC_ENVS.filter((name) => !process.env[name]?.trim())

  return {
    configured: missing.length === 0,
    enabled: process.env.RANDOM_TESTING_SCHEDULE_SYNC_ENABLED?.trim().toLowerCase() === 'true',
    missing,
  }
}
