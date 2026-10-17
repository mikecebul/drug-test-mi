import { expect, it } from 'vitest'
import type { Config } from 'payload'
import { staffNavigation } from './staffNavigation'

it('keeps required document routes and native edit permissions while simplifying staff navigation', async () => {
  const update = () => true
  const result = await staffNavigation({
    collections: ['clients', 'courts', 'employers', 'drug-tests', 'bookings', 'payments', 'private-media', 'pages'].map(
      (slug) => ({ slug, fields: [], access: { update } }),
    ),
    globals: [{ slug: 'header', fields: [] }],
  } as unknown as Config)
  for (const slug of ['drug-tests', 'bookings', 'payments', 'private-media']) {
    const collection = result.collections?.find((item) => item.slug === slug)
    expect(collection?.admin?.group).toBe(false)
    expect(collection?.admin?.hidden).toBeUndefined()
    expect(collection?.access?.update).toBe(update)
  }
  const hidden = result.collections?.find((item) => item.slug === 'pages')?.admin?.hidden
  if (typeof hidden !== 'function') throw new Error('Expected role visibility function')
  expect(hidden({ user: { collection: 'admins', role: 'admin' } as never })).toBe(true)
  expect(hidden({ user: { collection: 'admins', role: 'superAdmin' } as never })).toBe(false)
  expect(hidden({ user: null as never })).toBe(true)
})
