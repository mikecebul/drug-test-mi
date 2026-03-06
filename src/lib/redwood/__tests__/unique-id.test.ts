import { describe, expect, it } from 'vitest'

import { buildRedwoodUniqueId, REDWOOD_UNIQUE_ID_LENGTH } from '@/lib/redwood/unique-id'

describe('buildRedwoodUniqueId', () => {
  it('returns deterministic 20-character IDs', () => {
    const first = buildRedwoodUniqueId('68e51e5a5cb1aa425abc79c4')
    const second = buildRedwoodUniqueId('68e51e5a5cb1aa425abc79c4')

    expect(first).toBe(second)
    expect(first).toHaveLength(REDWOOD_UNIQUE_ID_LENGTH)
    expect(first).toMatch(/^[A-F0-9]{20}$/)
  })

  it('returns different IDs for different clients', () => {
    const a = buildRedwoodUniqueId('client-a')
    const b = buildRedwoodUniqueId('client-b')

    expect(a).not.toBe(b)
  })

  it('throws on empty client IDs', () => {
    expect(() => buildRedwoodUniqueId('   ')).toThrow('client ID is empty')
  })
})
