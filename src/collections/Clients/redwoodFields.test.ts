import type { Field } from 'payload'
import { describe, expect, it } from 'vitest'

import {
  redwoodDefaultTestTypeField,
  redwoodSyncTab,
  redwoodSystemFieldAccess,
} from './redwoodFields'

function getNamedFields(fields: Field[]): Array<Field & { name: string }> {
  return fields.filter((field): field is Field & { name: string } => 'name' in field && typeof field.name === 'string')
}

describe('Redwood field access', () => {
  it('applies system-managed access to every Redwood integration field', () => {
    const fields = getNamedFields([redwoodDefaultTestTypeField, ...redwoodSyncTab.fields])

    expect(fields.length).toBeGreaterThan(1)
    for (const field of fields) {
      expect('access' in field ? field.access : undefined, `${field.name} must use Redwood system field access`).toBe(
        redwoodSystemFieldAccess,
      )
    }
  })

  it('allows only admins to read and requires overrideAccess for all writes', async () => {
    const adminArgs = { req: { user: { collection: 'admins', id: 'admin-1' } } } as never
    const clientArgs = { req: { user: { collection: 'clients', id: 'client-1' } } } as never
    const publicArgs = { req: { user: null } } as never

    expect(await redwoodSystemFieldAccess.read(adminArgs)).toBe(true)
    expect(await redwoodSystemFieldAccess.read(clientArgs)).toBe(false)
    expect(await redwoodSystemFieldAccess.read(publicArgs)).toBe(false)
    expect(await redwoodSystemFieldAccess.create(adminArgs)).toBe(false)
    expect(await redwoodSystemFieldAccess.update(adminArgs)).toBe(false)
  })
})
