import { describe, expect, it } from 'vitest'
import { Clients } from '.'

describe('Clients authentication', () => {
  it('does not require or send email verification', () => {
    expect(Clients.auth).toBeTypeOf('object')
    expect(Clients.auth).not.toHaveProperty('verify')
  })
})
