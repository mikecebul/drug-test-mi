import { describe, expect, it } from 'vitest'

import { formatPhoneInput, formatPhoneNumber } from './client-utils'

describe('client phone formatting', () => {
  it('formats stored digits for display', () => {
    expect(formatPhoneNumber('3135556666')).toBe('(313) 555-6666')
  })

  it.each([
    ['3', '(3'],
    ['3135', '(313) 5'],
    ['3135556666', '(313) 555-6666'],
    ['+1 (313) 555-6666', '(313) 555-6666'],
  ])('formats phone input progressively', (value, expected) => {
    expect(formatPhoneInput(value)).toBe(expected)
  })
})
