const DEFAULT_REDWOOD_ACCOUNT_NUMBER = '310974'
export const REDWOOD_TASK_RETRIES = 3

export type RedwoodAutomationRuntimeState = {
  configured: boolean
  configuredValue: string | null
  enabled: boolean
  nodeEnv: string | null
}

function readRuntimeEnv(name: string): string | undefined {
  const value = Reflect.get(process.env, name)
  return typeof value === 'string' ? value : undefined
}

export function hasExhaustedRedwoodRetries(totalTried: unknown): boolean {
  return typeof totalTried === 'number' && totalTried >= REDWOOD_TASK_RETRIES
}

export function getRedwoodAutomationRuntimeState(): RedwoodAutomationRuntimeState {
  const configuredValue = readRuntimeEnv('REDWOOD_AUTOMATION_ENABLED')?.trim().toLowerCase() || null
  const nodeEnv = readRuntimeEnv('NODE_ENV')?.trim() || null
  const enabled = configuredValue
    ? configuredValue === 'true' || configuredValue === '1' || configuredValue === 'yes'
    : nodeEnv !== 'production'

  return {
    configured: configuredValue !== null,
    configuredValue,
    enabled,
    nodeEnv,
  }
}

export function isRedwoodAutomationEnabled(): boolean {
  return getRedwoodAutomationRuntimeState().enabled
}

export function assertRedwoodAutomationEnabled(action: string): void {
  if (!isRedwoodAutomationEnabled()) {
    throw new Error(`Redwood ${action} is disabled. Set REDWOOD_AUTOMATION_ENABLED=true to enable automation.`)
  }
}

function parseAccountList(rawValue: string | undefined): string[] {
  const parsed = (rawValue || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)

  return parsed.length > 0 ? parsed : [DEFAULT_REDWOOD_ACCOUNT_NUMBER]
}

export function getRedwoodAccountNumber(): string {
  return readRuntimeEnv('REDWOOD_ACCOUNT_NUMBER')?.trim() || DEFAULT_REDWOOD_ACCOUNT_NUMBER
}

export function getAllowedRedwoodAccountNumbers(): string[] {
  return parseAccountList(readRuntimeEnv('REDWOOD_ALLOWED_ACCOUNT_NUMBERS'))
}

export function isRedwoodAccountAllowed(accountNumber: string): boolean {
  return getAllowedRedwoodAccountNumbers().includes(accountNumber.trim())
}

export function assertRedwoodMutationAllowed(accountNumber: string, action: string): void {
  assertRedwoodAutomationEnabled(action)

  const normalizedAccountNumber = accountNumber.trim()

  if (!normalizedAccountNumber) {
    throw new Error(`Redwood ${action} requires REDWOOD_ACCOUNT_NUMBER to be configured.`)
  }

  if (!isRedwoodAccountAllowed(normalizedAccountNumber)) {
    throw new Error(
      `Redwood ${action} is blocked for account ${normalizedAccountNumber}. Allowed accounts: ${getAllowedRedwoodAccountNumbers().join(', ')}`,
    )
  }
}
