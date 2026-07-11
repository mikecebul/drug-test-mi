const DEFAULT_REDWOOD_ACCOUNT_NUMBER = '310974'
export const REDWOOD_TASK_RETRIES = 3

export function hasExhaustedRedwoodRetries(totalTried: unknown): boolean {
  return typeof totalTried === 'number' && totalTried >= REDWOOD_TASK_RETRIES
}

export function isRedwoodAutomationEnabled(): boolean {
  const configured = process.env.REDWOOD_AUTOMATION_ENABLED?.trim().toLowerCase()

  if (configured) {
    return configured === 'true' || configured === '1' || configured === 'yes'
  }

  // Require an explicit production opt-in while keeping local development and tests usable.
  return process.env.NODE_ENV !== 'production'
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
  return process.env.REDWOOD_ACCOUNT_NUMBER?.trim() || DEFAULT_REDWOOD_ACCOUNT_NUMBER
}

export function getAllowedRedwoodAccountNumbers(): string[] {
  return parseAccountList(process.env.REDWOOD_ALLOWED_ACCOUNT_NUMBERS)
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
