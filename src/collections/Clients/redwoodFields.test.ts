import type { Field } from 'payload'
import { describe, expect, it } from 'vitest'

import { testTypeSelectOptions } from '@/config/test-types'

import { redwoodDefaultTestTypeField, redwoodSyncTab, redwoodSystemFieldAccess } from './redwoodFields'

function getNamedFields(fields: Field[]): Array<Field & { name: string }> {
  return fields.flatMap((field) => {
    const namedField = 'name' in field && typeof field.name === 'string' ? [field as Field & { name: string }] : []
    const nestedFields = 'fields' in field && Array.isArray(field.fields) ? getNamedFields(field.fields) : []
    return [...namedField, ...nestedFields]
  })
}

describe('Redwood field access', () => {
  it('stores the default test as a configured value instead of a legacy relationship', () => {
    expect(redwoodDefaultTestTypeField).toMatchObject({
      name: 'defaultTestType',
      type: 'select',
      options: testTypeSelectOptions,
    })
    expect('relationTo' in redwoodDefaultTestTypeField).toBe(false)
  })

  it('applies system-managed access to internal Redwood integration fields', () => {
    const fields = getNamedFields([redwoodDefaultTestTypeField, ...redwoodSyncTab.fields])
    const clientVisibleOrAdminManaged = new Set([
      'randomTestingActive',
      'randomTestingWeekdayTime',
      'randomTestingWeekendTime',
      'redwoodCallInCode',
    ])

    expect(fields.length).toBeGreaterThan(1)
    for (const field of fields.filter((field) => !clientVisibleOrAdminManaged.has(field.name))) {
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

  it('lets admins manage random-testing enrollment and lets clients read their instructions', async () => {
    const fields = new Map(getNamedFields(redwoodSyncTab.fields).map((field) => [field.name, field]))
    type TestedAccess = {
      create?: (args: never) => boolean | Promise<boolean>
      read?: (args: never) => boolean | Promise<boolean>
      update?: (args: never) => boolean | Promise<boolean>
    }
    const accessFor = (name: string) => (fields.get(name) as (Field & { access?: TestedAccess }) | undefined)?.access
    const activeAccess = accessFor('randomTestingActive')
    const callInCodeAccess = accessFor('redwoodCallInCode')
    const weekdayTimeAccess = accessFor('randomTestingWeekdayTime')
    const adminArgs = { req: { user: { collection: 'admins', id: 'admin-1' } } } as never
    const clientArgs = { req: { user: { collection: 'clients', id: 'client-1' } } } as never
    const publicArgs = { req: { user: null } } as never

    expect(await activeAccess?.create?.(adminArgs)).toBe(true)
    expect(await activeAccess?.update?.(clientArgs)).toBe(false)
    expect(await activeAccess?.read?.(clientArgs)).toBe(true)
    expect(await callInCodeAccess?.read?.(clientArgs)).toBe(true)
    expect(await weekdayTimeAccess?.read?.(clientArgs)).toBe(true)
    expect(await callInCodeAccess?.read?.(publicArgs)).toBe(false)
  })
})
