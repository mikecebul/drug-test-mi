import { describe, expect, it, test } from 'vitest'
import { Clients } from '.'

describe('Clients authentication', () => {
  it('does not require or send email verification', () => {
    expect(Clients.auth).toBeTypeOf('object')
    expect(Clients.auth).not.toHaveProperty('verify')
  })

  test.each(['moneyOwed', 'creditBalance'])('only allows superadmins to update %s', (fieldName) => {
    const field = Clients.fields.find((candidate) => 'name' in candidate && candidate.name === fieldName)
    if (!field || !('access' in field) || !field.access?.update) {
      throw new Error(`${fieldName} update access is not configured`)
    }

    const updateAccess = field.access.update
    expect(
      updateAccess({
        req: { user: { collection: 'clients', id: 'client-1' } },
      } as Parameters<typeof updateAccess>[0]),
    ).toBe(false)
    expect(
      updateAccess({
        req: { user: { collection: 'admins', role: 'admin' } },
      } as Parameters<typeof updateAccess>[0]),
    ).toBe(false)
    expect(
      updateAccess({
        req: { user: { collection: 'admins', role: 'superAdmin' } },
      } as Parameters<typeof updateAccess>[0]),
    ).toBe(true)
  })
})
