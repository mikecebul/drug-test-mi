const DEFAULT_REDWOOD_ACCOUNT_NUMBER = '310974'

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
