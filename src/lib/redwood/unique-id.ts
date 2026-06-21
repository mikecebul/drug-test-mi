import { createHash } from 'node:crypto'

export const REDWOOD_UNIQUE_ID_LENGTH = 20

export function buildRedwoodUniqueId(clientId: string): string {
  const normalizedClientId = clientId.trim()

  if (!normalizedClientId) {
    throw new Error('Cannot generate Redwood unique ID: client ID is empty.')
  }

  return createHash('sha256').update(normalizedClientId).digest('hex').slice(0, REDWOOD_UNIQUE_ID_LENGTH).toUpperCase()
}
